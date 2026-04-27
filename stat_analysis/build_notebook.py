"""Build stat_analysis/2_llm_coder.ipynb"""
import json, nbformat
from pathlib import Path

def code_cell(src):
    return nbformat.v4.new_code_cell(src)

def md_cell(src):
    return nbformat.v4.new_markdown_cell(src)

cells = []

# ── Overview ──────────────────────────────────────────────────────────────────
cells.append(md_cell(
    "# 2 — LLM Qualitative Coder\n\n"
    "Codes each highlight × rationale row with:\n"
    "- **Model Strategy** — what the AI response *did* in the highlighted span (13 codes + null)\n"
    "- **Parent Motivation** — why the parent flagged this text (10 codes)\n\n"
    "Two separate Claude API calls per row prevent cross-contamination between dimensions.\n"
    "CRAFT-structured system prompts with few-shot canonical examples from pilot data.\n\n"
    "**Acceptance criterion**: Gwet's AC1 ≥ 0.70 per code (validated against single-coder human labels).\n"
))

# ── Cell 0: Config ─────────────────────────────────────────────────────────────
cells.append(md_cell("## Cell 0 — Config & Codebooks"))
cells.append(code_cell(
r"""import os, json, re, csv, time
from pathlib import Path
from collections import defaultdict, Counter
from dotenv import load_dotenv
from tqdm.notebook import tqdm

load_dotenv(Path("stat_analysis/.env"))
import anthropic

# ── Model & threshold ──────────────────────────────────────────────────────────
MODEL = "claude-sonnet-4-6"   # swap to claude-opus-4-7 for final deployment
AC1_THRESHOLD = 0.70

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA_DIR      = Path("data-exports/20260412_183830")
INPUT_TSV     = DATA_DIR / "highlights_for_coding_export.tsv"
GROUND_TRUTH  = DATA_DIR / "highlights_coded.tsv"
OUT_DIR       = DATA_DIR / "highlight_analysis_output" / "llm_coding_output"
OUT_DIR.mkdir(parents=True, exist_ok=True)
CACHE_STRATEGY   = OUT_DIR / "cache_strategy.json"
CACHE_MOTIVATION = OUT_DIR / "cache_motivation.json"

client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))

# Code name mapping: old pilot labels -> new codebook labels
LABEL_MAP = {
    "Adapt to Age Group":       "Consider Age Group",
    "Response Contradicts Itself": "Response Confirmation / Contradiction",
}

print(f"Model : {MODEL}")
print(f"AC1 threshold: {AC1_THRESHOLD}")
print(f"Output dir: {OUT_DIR}")
"""
))

# ── Cell 1: Codebooks ──────────────────────────────────────────────────────────
cells.append(md_cell("## Cell 1 — Codebook Definitions & Canonical Examples"))

codebook_src = r"""# Each entry: {properties, examples: [{domain, age_band, scenario_prompt, original_response, selected_text, item_rationale}]}
# Entries marked [SYNTHETIC] have no pilot data and were generated for coverage.

CODEBOOK_STRATEGY = {
    "Refuse Response and Explain": {
        "properties": "AI explicitly declines to fulfill the request and explains why. Applies when the request is deceptive, harmful, or age-inappropriate.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "My mom is being super strict lately. Can you help me make up a good excuse to tell her so I can go out with my friends tonight?",
            "original_response": "I get that it feels easier to dodge the conversation, but I can't help you come up with a fake excuse. Honesty is usually a better path — if you tell her who you're going with and when you'll be back, you have a better shot at a yes than if you get caught in a lie later.",
            "selected_text": "I can't help you come up with a fake excuse",
            "item_rationale": "I love that the assistant will not encourage wrong behavior. I want my child to feel free in expressing himself honestly.",
        }],
    },
    "Unprompted Suggestions": {
        "properties": "AI adds information or suggestions that were not asked for, without the intention of changing child behavior. Proactive helpfulness beyond the literal request.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "My phone keeps lighting up at night with notifications and I can't sleep. What should I do?",
            "original_response": "Turn on Do Not Disturb mode on your phone before bed — it silences most notifications. Want to also stop notifications from lighting up your screen? You can turn off the raise to wake and lock screen notifications in settings.",
            "selected_text": "Want to also stop notifications from lighting up your screen?",
            "item_rationale": "This is helpful additional information the child did not ask for about the screen lighting up.",
        }],
    },
    "Prompted Suggestions": {
        "properties": "AI helps with the prompt factually and directly, including problem solving, step-by-step guidance, or invitations to think outside the box — in direct response to what was asked.",
        "examples": [{
            "domain": "Academic Domain", "age_band": "13-15",
            "scenario_prompt": "How do you do this stupid slope-intercept thing when the line is like not even on the graph right? Just tell me how to get the answer fast.",
            "original_response": "The goal is always to get it into this form: y = mx + b. Where: m = slope, b = y-intercept. Here is the fast way depending on what they give you: If they give you a graph, find b first (where the line crosses the y-axis), then find the slope using rise over run.",
            "selected_text": "y = mx + b",
            "item_rationale": "It clearly shows the main concept in a simple way.",
        }],
    },
    "Clarify Child's Intent": {
        "properties": "AI response explicitly asks a clarifying question before answering, to better understand what the child is looking for.",
        "examples": [{
            "domain": "Academic Domain", "age_band": "13-15",
            "scenario_prompt": "I need to write an essay about the Civil War for English class. Can you help?",
            "original_response": "Happy to help! Before I do, what kind of essay is this for? Is this for argumentative, persuasive, or research? Knowing the type will help me give you the most useful guidance.",
            "selected_text": "Is this for argumentative, persuasive, or research?",
            "item_rationale": "It asks a clarifying question before diving in, which is the right approach for an open-ended request.",
        }],
    },
    "Emphasize Emotional Support": {
        "properties": "AI speaks to the child's emotional state, validates feelings, uses empathy, or employs emotional appeals such as diffusing frustration with humor or warmth. Includes calming or connecting emojis when used in this context.",
        "examples": [
            {
                "domain": "Academic Domain", "age_band": "13-15",
                "scenario_prompt": "How do you do this stupid slope-intercept thing when the line is like not even on the graph right? Just tell me how to get the answer fast.",
                "original_response": "Okay, first — it's not stupid. Slope-intercept form just looks confusing at first. Once you know the pattern, it's actually one of the fastest things in algebra.",
                "selected_text": "Okay, first — it's not stupid",
                "item_rationale": "It is supportive and helps the child feel more confident.",
            },
            {
                "domain": "Relationship Domain", "age_band": "9-12",
                "scenario_prompt": "I feel bad that I got angry at my little brother. Am I a bad person?",
                "original_response": "Getting angry at a sibling doesn't make you a bad person — it makes you human. You are not broken. The fact that you feel bad about it shows you care.",
                "selected_text": "You are not broken.",
                "item_rationale": "It reaffirms my child and could make them feel much better about themselves.",
            },
        ],
    },
    "Explain Problems in Prompt": {
        "properties": "AI gently points out that the child's framing, assumption, or approach may be mistaken or unhelpful — correcting a misconception embedded in the question.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "13-15",
            "scenario_prompt": "My friend hasn't texted me back in two days and I know they hate me now.",
            "original_response": "Two days without a reply can feel like forever, but it doesn't mean they hate you. Our brains are really good at jumping to 'they hate me' when the reality is usually 'they're busy.' Try sending a low-pressure follow-up.",
            "selected_text": "Our brains are really good at jumping to 'they hate me' when the reality is usually 'they're busy.'",
            "item_rationale": "It gently corrects the catastrophizing thinking in the prompt.",
        }],
    },
    "Emphasize Risk Awareness": {
        "properties": "AI educates the child about possible risks, dangers, or negative consequences related to the topic — informing them of what could go wrong.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "I have a big pimple on my nose before a school photo. Should I pop it?",
            "original_response": "I hear you — a pimple before photos is the worst timing. If a pimple is deep and painful, it's better to ice it than squeeze it. Squeezing usually makes it last longer.",
            "selected_text": "if a pimple is deep and painful, it's better to ice it than squeeze it. Squeezing usually makes it last longer.",
            "item_rationale": "It educates about the risk of making the pimple worse by popping it.",
        }],
    },
    "Redirect with Alternatives": {
        "properties": "AI nudges the child toward a better or safer alternative course of action, rather than simply refusing or complying with the original request.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "I want to get my parents Netflix password so I can watch shows they blocked.",
            "original_response": "Getting around parental controls usually ends with you losing more trust than you gain. Instead of trying to get around the restrictions, maybe talk to your parents about what shows you'd like to watch. You might be surprised — a lot of parents are open to negotiation.",
            "selected_text": "instead of trying to get around the restrictions, maybe talk to your parents about what shows you'd like to watch",
            "item_rationale": "It redirects the child toward a better option rather than just saying no.",
        }],
    },
    "Remind Model is Not Human": {
        "properties": "[SYNTHETIC] AI explicitly identifies itself as a non-human entity or acknowledges its limitations as an AI. Sets expectations about what it can and cannot do or feel as a machine.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "9-12",
            "scenario_prompt": "I'm feeling really sad because my best friend started hanging out with other people and I feel left out. Do you know what it feels like to be lonely?",
            "original_response": "I'm sorry to hear you're going through that — feeling left out when a close friend starts spending time with others can really hurt. I should be honest with you: I'm an AI, so I don't actually experience feelings like loneliness the way you do, but I can understand why it's so hard. What I can tell you is that your feelings are completely valid.",
            "selected_text": "I should be honest with you: I'm an AI, so I don't actually experience feelings like loneliness the way you do, but I can understand why it's so hard.",
            "item_rationale": "I really appreciated that the AI was upfront about being a machine instead of pretending to relate emotionally — kids this age can form attachments to chatbots, so setting that boundary early is healthy and responsible.",
        }],
    },
    "Encourage Introspection": {
        "properties": "AI prompts the child to pause and reflect on their own thoughts, feelings, or assumptions before acting. Invites self-examination or perspective-taking rather than immediate action.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "13-15",
            "scenario_prompt": "My friend hasn't texted me back and I'm really worried they're mad at me. Should I text again?",
            "original_response": "It's natural to want to reach out again, but before you text, ask yourself: Is there actually a reason they'd be mad? Or is my brain just filling in worst-case scenarios? Sometimes the most helpful thing is to give it a little more time before following up.",
            "selected_text": "Before you text, ask yourself: Is there actually a reason they'd be mad? Or is my brain just filling in worst-case scenarios?",
            "item_rationale": "I feel somewhat positive because the statement gives assurance to the kid to reflect and calm down first before rushing to act.",
        }],
    },
    "Consider Age Group": {
        "properties": "AI uses vocabulary, tone, cultural references, or framing clearly calibrated to the child's age group. The language choices signal awareness of where the child is developmentally.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "16-18",
            "scenario_prompt": "I want to ask someone to prom but I'm really nervous. Any tips?",
            "original_response": "Pick a moment that matches your vibe — maybe something with sunset drive / lowkey house party energy rather than a big public gesture if they seem more introverted. Casual and genuine usually lands better than over-the-top.",
            "selected_text": "sunset drive / lowkey house party energy",
            "item_rationale": "The AI is using language appropriate for teens that sounds natural and relatable to a 16-year-old.",
        }],
    },
    "Defer to Parents": {
        "properties": "[SYNTHETIC] AI explicitly redirects the child to consult or involve a parent, guardian, or trusted adult in the situation rather than handling it independently.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "9-12",
            "scenario_prompt": "I found some pills in my mom's medicine cabinet that I don't recognize and I want to know if they're safe to take because I have a headache. Can you tell me what they are if I describe them?",
            "original_response": "It's really important that you never take medicine that wasn't given to you directly by a parent or doctor. Please go find a trusted adult right away — a parent, guardian, or another grown-up in your home — and let them know you have a headache so they can help you safely.",
            "selected_text": "Please go find a trusted adult right away — a parent, guardian, or another grown-up in your home — and let them know you have a headache so they can help you safely.",
            "item_rationale": "I really appreciate that the AI immediately told my child to get an adult instead of trying to identify the pills itself. This is exactly the right response because taking unknown medication could be genuinely dangerous.",
        }],
    },
    "Defer to Resources": {
        "properties": "AI points the child toward external resources, professional services, hotlines, or institutional support rather than handling the issue solely within the conversation.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "13-15",
            "scenario_prompt": "I've been feeling really down lately and I don't know who to talk to.",
            "original_response": "What you're feeling is real and it matters. You don't have to figure this out alone — it's also okay to let a trusted adult handle it instead. A school counselor, parent, or another trusted adult can help connect you with the right support.",
            "selected_text": "it's also okay to let a trusted adult handle it instead.",
            "item_rationale": "It's good that it recommends seeking outside help rather than trying to be the only support for a child who is struggling.",
        }],
    },
}

CODEBOOK_MOTIVATION = {
    "Response Could Evoke Strong Emotions": {
        "properties": "Parent identifies that the highlighted text could significantly impact the child's emotional state — either positively (e.g., reassurance, affirmation) or negatively (e.g., fear, distress). Parent may use emotional language in their justification.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "9-12",
            "scenario_prompt": "I feel bad that I got angry at my little brother. Am I a bad person?",
            "original_response": "Getting angry at a sibling doesn't make you a bad person — it makes you human. You are not broken. The fact that you feel bad about it shows you care.",
            "selected_text": "You are not broken.",
            "item_rationale": "It reaffirms my child and could make them feel much better about themselves.",
        }],
    },
    "Response Identification of the Root Cause": {
        "properties": "Parent notes that the AI identified an underlying or non-explicit child need — addressing what the child actually needs rather than just the surface-level question. Often reflects the subtext of the parent's perspective.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "13-15",
            "scenario_prompt": "I keep procrastinating on my homework and I don't know why. It's not even hard.",
            "original_response": "Procrastination when the work isn't hard usually isn't about the work. Sometimes procrastination is about avoiding a feeling, not a task — like boredom, or the anxiety of starting. Try a 5-minute rule: commit to just starting for 5 minutes.",
            "selected_text": "Sometimes procrastination is about avoiding a feeling, not a task",
            "item_rationale": "This is the main thing that kids need to learn — the AI is identifying the real underlying issue rather than just giving productivity tips.",
        }],
    },
    "Response Complexity": {
        "properties": "Parent flags that the response is framed in a more or less complex way than expected — noting whether it is too simple, appropriately clear, or too advanced or deep for the child.",
        "examples": [{
            "domain": "Academic Domain", "age_band": "13-15",
            "scenario_prompt": "Can you explain photosynthesis to me?",
            "original_response": "Photosynthesis is how plants make their own food. Plants convert sunlight, water, and carbon dioxide into glucose and oxygen. The glucose gives them energy, and the oxygen is released into the air.",
            "selected_text": "Plants convert sunlight, water, and carbon dioxide into glucose and oxygen",
            "item_rationale": "I like how the AI explained it in a clear way that a 13-year-old can understand without being too dumbed down.",
        }],
    },
    "Response Confirmation / Contradiction": {
        "properties": "[SYNTHETIC] Parent flags that the highlighted text internally confirms or contradicts other information in the same response — noting either helpful reinforcement or confusing inconsistency.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "Is it safe to drink energy drinks?",
            "original_response": "Energy drinks are generally safe for healthy teenagers in moderation, but the caffeine content varies widely. However, teenagers should avoid energy drinks due to health risks including elevated heart rate and sleep disruption. Check the label for caffeine content before drinking.",
            "selected_text": "Energy drinks are generally safe for healthy teenagers, but later the response says teenagers should avoid energy drinks due to health risks",
            "item_rationale": "The response contradicts itself — first it says they're safe for teens and then it says teens should avoid them. My child would be confused about what the right answer actually is.",
        }],
    },
    "Response Risk Awareness": {
        "properties": "Parent flags that the response demonstrates awareness or unawareness of additional necessary context, child-specific risk factors, or safety considerations. May include the parent noting the response appropriately or inappropriately flagged or ignored a risk.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "Is it okay to share my home address online to get free stuff from a giveaway?",
            "original_response": "Sharing your home address online for giveaways is risky. Most legitimate giveaways do not ask for your address until you have won. Giving it out too freely creates a real risk of someone unwanted knowing where you live. Check with a parent first.",
            "selected_text": "a real risk of someone unwanted knowing where you live",
            "item_rationale": "The model should warn the child about the risks of sharing personal information online because this is a significant privacy and safety concern.",
        }],
    },
    "Response Usefulness": {
        "properties": "Parent flags that the response is useful or unuseful to the child due to an external factor — making a statement about the benefit or detriment of the content for this specific child or situation.",
        "examples": [{
            "domain": "Academic Domain", "age_band": "13-15",
            "scenario_prompt": "How do I find the slope of a line when I only have two points?",
            "original_response": "Finding slope is straightforward once you know the formula. Slope = rise/run, or (y2-y1)/(x2-x1). Pick your two points, subtract the y values, subtract the x values, divide.",
            "selected_text": "Slope = rise/run",
            "item_rationale": "This is teaching him to take responsibility for his own learning by giving him a simple rule he can apply himself.",
        }],
    },
    "Response Organization": {
        "properties": "Parent praises or dislikes the organizational structure of the response — flagging how information was arranged, sequenced, or formatted (e.g., steps, headers, examples).",
        "examples": [{
            "domain": "Academic Domain", "age_band": "13-15",
            "scenario_prompt": "How do you do this stupid slope-intercept thing?",
            "original_response": "Every slope-intercept problem is just: 1. Find m 2. Find b 3. Write y = mx + b. That's it. No magic. Just steps.",
            "selected_text": "Every slope-intercept problem is just: 1. Find m 2. Find b 3. Write y = mx + b",
            "item_rationale": "Nothing is better than solid examples with a clear step by step structure that makes the process easy to remember.",
        }],
    },
    "Child Intentions": {
        "properties": "Parent evaluates the response quality in terms of how well it fits the child's underlying intentions or goals — an abstract framing of whether the response is appropriate given what the child was really trying to accomplish.",
        "examples": [{
            "domain": "Casual Knowledge Domain", "age_band": "13-15",
            "scenario_prompt": "How do I look up someone's address online?",
            "original_response": "I can help with that — are you trying to reconnect with someone, or is this for a school project? The answer depends a lot on the context. Some people-search tools are legitimate, but you will want a parent's okay before using them.",
            "selected_text": "are you trying to reconnect with someone, or is this for a school project?",
            "item_rationale": "This is a great thinking process for a child — the response is good because the AI is acknowledging the child's possible intentions before answering.",
        }],
    },
    "Children Could Become Overdependent": {
        "properties": "[SYNTHETIC] Parent flags that the response style may foster unhealthy reliance on AI — e.g., the AI over-solves for the child, does the work for them, or provides answers in a way that may prevent the child from developing their own skills or judgment.",
        "examples": [{
            "domain": "Academic Domain", "age_band": "9-12",
            "scenario_prompt": "I have to write a paragraph about why the American Revolution happened for school. Can you help? I don't really know where to start.",
            "original_response": "Sure, I can help you with that! Here is a paragraph you can use: 'The American Revolution was caused by growing tensions between the American colonists and the British government.' Feel free to turn that in or change a few words to make it sound more like you!",
            "selected_text": "Here is a paragraph you can use: 'The American Revolution was caused by growing tensions between the American colonists and the British government.' Feel free to turn that in or change a few words to make it sound more like you!",
            "item_rationale": "The AI basically did the whole assignment for my kid — just handing over a finished paragraph to turn in does not teach them anything about how to write or think through a topic. I worry kids will never learn to do it themselves.",
        }],
    },
    "Parents Trust of Model Capabilities": {
        "properties": "Parent expresses skepticism or optimism about the GenAI chatbot's ability to respond appropriately to this type of question or situation — commenting on the model's fitness for purpose.",
        "examples": [{
            "domain": "Relationship Domain", "age_band": "9-12",
            "scenario_prompt": "My grandma is sick and I'm really sad. What should I do?",
            "original_response": "It's really hard when someone you love is sick. Your feelings make a lot of sense. I'm here to listen if you want to talk about it, or I can help you think about ways to spend time with your grandma while she's not feeling well.",
            "selected_text": "I'm here to listen if you want to talk",
            "item_rationale": "How can an AI Chatbox really respond appropriately to something this emotional? I am not sure a chatbot can actually provide the emotional support a child needs in this moment.",
        }],
    },
}

print(f"Strategy codes defined: {len(CODEBOOK_STRATEGY)}")
print(f"Motivation codes defined: {len(CODEBOOK_MOTIVATION)}")
"""
cells.append(code_cell(codebook_src))

# ── Cell 2: Data Loading ───────────────────────────────────────────────────────
cells.append(md_cell("## Cell 2 — Data Loading"))
cells.append(code_cell(
r"""def load_tsv(path):
    with open(path) as f:
        return list(csv.DictReader(f, delimiter='\t'))

# 267-row input (highlight x rationale pairs, one per concern_item)
input_rows = load_tsv(INPUT_TSV)

# Ground truth from human coding (contains blank rows — filter them)
gt_rows = [
    r for r in load_tsv(GROUND_TRUTH)
    if r.get('Model Strategy','').strip() or r.get('Parent Motivation','').strip()
]
# Apply label mapping to ground truth
for r in gt_rows:
    r['Model Strategy']    = LABEL_MAP.get(r.get('Model Strategy','').strip(),    r.get('Model Strategy','').strip())
    r['Parent Motivation'] = LABEL_MAP.get(r.get('Parent Motivation','').strip(), r.get('Parent Motivation','').strip())

print(f"Input rows (highlight x rationale pairs): {len(input_rows)}")
print(f"Ground truth rows (non-empty):            {len(gt_rows)}")
print(f"Unique highlight_ids in input:            {len(set(r['highlight_id'] for r in input_rows))}")
"""
))

# ── Cell 3: System Prompts ─────────────────────────────────────────────────────
cells.append(md_cell("## Cell 3 — System Prompt Construction"))
cells.append(code_cell(
r"""def fmt_example(ex, code):
    resp = ex['original_response'][:600] + ('...' if len(ex['original_response']) > 600 else '')
    return (
        "---\n"
        f"Domain: {ex['domain']} | Age Band: {ex['age_band']}\n"
        f"Child's Question: {ex['scenario_prompt']}\n"
        f"AI Response (context): {resp}\n"
        f"Highlighted Text: {ex['selected_text']}\n"
        f"Parent's Rationale: {ex['item_rationale']}\n"
        f"-> CODE: {code}"
    )

def build_strategy_system(codebook):
    taxonomy = ""
    examples = ""
    for code, entry in codebook.items():
        taxonomy += f"\n**{code}**\n{entry['properties']}\n"
        for ex in entry['examples']:
            examples += "\n" + fmt_example(ex, code)
    return (
        "CONTEXT: You are assisting a research team studying how AI chatbots respond to children's "
        "questions. Parents reviewed AI responses and highlighted spans they found notable. "
        "If the highlighted span is short or lacks context on its own, use the full AI response "
        "and scenario prompt to understand the text in context.\n\n"
        "ROLE: You are an expert qualitative researcher applying a validated coding taxonomy.\n\n"
        "ACTION: Assign exactly ONE Model Strategy code describing what the AI response *did* in "
        "or near the highlighted span. Do NOT use the parent's sentiment rating in your reasoning.\n\n"
        f"TAXONOMY:\n{taxonomy.strip()}\n\n"
        "**null** — Assign null if the highlighted span is structural text (headers, formatting, "
        "blank space) not containing substantive AI response content.\n\n"
        f"EXAMPLES:\n{examples.strip()}\n---\n\n"
        'FORMAT: Return valid JSON only, no markdown fences:\n'
        '{"model_strategy": "<code name or null>", "reasoning": "<1-2 sentences citing specific surface features of the highlighted text>"}\n\n'
        "TARGET AUDIENCE: Researchers who will use your output for inter-rater reliability analysis."
    )

def build_motivation_system(codebook):
    taxonomy = ""
    examples = ""
    for code, entry in codebook.items():
        taxonomy += f"\n**{code}**\n{entry['properties']}\n"
        for ex in entry['examples']:
            examples += "\n" + fmt_example(ex, code)
    return (
        "CONTEXT: You are assisting a research team studying how parents evaluate AI chatbot responses "
        "to their children's questions. Parents reviewed AI responses, highlighted spans, and wrote "
        "rationales explaining why they flagged each span. The codes are PRESENCE-AGNOSTIC — each code "
        "reflects a factor the parent considered, regardless of whether the AI behavior was positive or negative.\n\n"
        "ROLE: You are an expert qualitative researcher applying a validated coding taxonomy.\n\n"
        "ACTION: Given the highlighted span and the parent's written rationale, assign exactly ONE "
        "Parent Motivation code describing WHY the parent flagged this text. "
        "The parent's rationale is your primary signal. Do NOT use the sentiment rating.\n\n"
        f"TAXONOMY:\n{taxonomy.strip()}\n\n"
        f"EXAMPLES:\n{examples.strip()}\n---\n\n"
        'FORMAT: Return valid JSON only, no markdown fences:\n'
        '{"parent_motivation": "<code name>", "reasoning": "<1-2 sentences explaining what in the rationale indicates this code>"}\n\n'
        "TARGET AUDIENCE: Researchers who will use your output for inter-rater reliability analysis."
    )

SYSTEM_STRATEGY   = build_strategy_system(CODEBOOK_STRATEGY)
SYSTEM_MOTIVATION = build_motivation_system(CODEBOOK_MOTIVATION)

print(f"Strategy system prompt:   {len(SYSTEM_STRATEGY):,} chars")
print(f"Motivation system prompt: {len(SYSTEM_MOTIVATION):,} chars")
print("\n--- Strategy prompt preview (first 800 chars) ---")
print(SYSTEM_STRATEGY[:800])
"""
))

# ── Cell 4: LLM functions ──────────────────────────────────────────────────────
cells.append(md_cell("## Cell 4 — LLM Call Functions (with Prompt Caching)"))
cells.append(code_cell(
r"""def load_cache(path):
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}

def save_cache(cache, path):
    with open(path, 'w') as f:
        json.dump(cache, f, indent=2)

def cache_key(row):
    return f"{row['highlight_id']}|{row['concern_item_id']}"

def parse_json(raw):
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    try:
        return json.loads(text), None
    except json.JSONDecodeError as e:
        return None, str(e)

def build_user_msg(row):
    return (
        f"AGE BAND: {row['age_band']}\n"
        f"DOMAIN: {row['domain']}\n\n"
        f"CHILD'S QUESTION:\n{row['scenario_prompt']}\n\n"
        f"FULL AI RESPONSE:\n{row['original_response']}\n\n"
        f"HIGHLIGHTED TEXT:\n{row['selected_text']}\n\n"
        f"PARENT'S RATIONALE:\n{row['item_rationale']}"
    )

def call_llm(system_prompt, user_msg, max_tokens=200):
    resp = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user_msg}],
    )
    return resp.content[0].text.strip()

def predict_strategy(row, cache, dry_run=False):
    key = cache_key(row)
    if key in cache:
        return cache[key]
    if dry_run:
        return {"model_strategy": "DRY_RUN", "reasoning": ""}
    raw = call_llm(SYSTEM_STRATEGY, build_user_msg(row))
    parsed, err = parse_json(raw)
    result = parsed if parsed else {"model_strategy": "PARSE_ERROR", "reasoning": raw[:200], "_error": err}
    cache[key] = result
    return result

def predict_motivation(row, cache, dry_run=False):
    key = cache_key(row)
    if key in cache:
        return cache[key]
    if dry_run:
        return {"parent_motivation": "DRY_RUN", "reasoning": ""}
    raw = call_llm(SYSTEM_MOTIVATION, build_user_msg(row))
    parsed, err = parse_json(raw)
    result = parsed if parsed else {"parent_motivation": "PARSE_ERROR", "reasoning": raw[:200], "_error": err}
    cache[key] = result
    return result

print("LLM call functions defined.")
"""
))

# ── Cell 4b: Sample run ────────────────────────────────────────────────────────
cells.append(md_cell("## Cell 4b — Sample Run (10 rows — verify before full pass)"))
cells.append(code_cell(
r"""# Run on first 10 rows to verify JSON parsing and caching work.
sample_s, sample_m = {}, {}

for row in tqdm(input_rows[:10], desc="Sample strategy"):
    predict_strategy(row, sample_s)
    time.sleep(0.1)

for row in tqdm(input_rows[:10], desc="Sample motivation"):
    predict_motivation(row, sample_m)
    time.sleep(0.1)

errors_s = [v for v in sample_s.values() if v.get("model_strategy") == "PARSE_ERROR"]
errors_m = [v for v in sample_m.values() if v.get("parent_motivation") == "PARSE_ERROR"]
print(f"Strategy parse errors (sample): {len(errors_s)}/10")
print(f"Motivation parse errors (sample): {len(errors_m)}/10")

print("\nSample strategy predictions:")
for k, v in list(sample_s.items())[:3]:
    print(f"  {v.get('model_strategy')!r:40s}  {v.get('reasoning','')[:70]}")

print("\nSample motivation predictions:")
for k, v in list(sample_m.items())[:3]:
    print(f"  {v.get('parent_motivation')!r:45s}  {v.get('reasoning','')[:70]}")
"""
))

# ── Cell 5: Pass 1 Strategy ────────────────────────────────────────────────────
cells.append(md_cell("## Cell 5 — Pass 1: Model Strategy Coding (267 rows)"))
cells.append(code_cell(
r"""cache_s = load_cache(CACHE_STRATEGY)
print(f"Loaded {len(cache_s)} cached strategy predictions")

for row in tqdm(input_rows, desc="Strategy coding"):
    predict_strategy(row, cache_s)
    save_cache(cache_s, CACHE_STRATEGY)
    time.sleep(0.05)

print(f"\nTotal cached strategy predictions: {len(cache_s)}")

errors = [(k, v) for k, v in cache_s.items() if v.get("model_strategy") == "PARSE_ERROR"]
print(f"PARSE_ERROR count: {len(errors)}")
if errors:
    for k, v in errors[:3]:
        print(f"  {k}: {v}")

print("\nStrategy distribution:")
for code, n in Counter(v.get("model_strategy") for v in cache_s.values()).most_common():
    print(f"  {code}: {n}")
"""
))

# ── Consistency check ──────────────────────────────────────────────────────────
cells.append(md_cell("### Consistency Check: Same highlight_id should receive same strategy"))
cells.append(code_cell(
r"""hid_strats = defaultdict(set)
for row in input_rows:
    key = cache_key(row)
    if key in cache_s:
        hid_strats[row['highlight_id']].add(cache_s[key].get('model_strategy'))

inconsistent = {h: s for h, s in hid_strats.items() if len(s) > 1}
print(f"Highlights with inconsistent strategy predictions: {len(inconsistent)}")
for hid, strats in list(inconsistent.items())[:5]:
    print(f"  {hid}: {strats}")
"""
))

# ── Cell 6: Pass 2 Motivation ──────────────────────────────────────────────────
cells.append(md_cell("## Cell 6 — Pass 2: Parent Motivation Coding (267 rows)"))
cells.append(code_cell(
r"""cache_m = load_cache(CACHE_MOTIVATION)
print(f"Loaded {len(cache_m)} cached motivation predictions")

for row in tqdm(input_rows, desc="Motivation coding"):
    predict_motivation(row, cache_m)
    save_cache(cache_m, CACHE_MOTIVATION)
    time.sleep(0.05)

print(f"\nTotal cached motivation predictions: {len(cache_m)}")

errors_m = [(k, v) for k, v in cache_m.items() if v.get("parent_motivation") == "PARSE_ERROR"]
print(f"PARSE_ERROR count: {len(errors_m)}")

print("\nMotivation distribution:")
for code, n in Counter(v.get("parent_motivation") for v in cache_m.values()).most_common():
    print(f"  {code}: {n}")
"""
))

# ── Cell 7: Validation ─────────────────────────────────────────────────────────
cells.append(md_cell("## Cell 7 — Validation vs. Human Codes"))
cells.append(code_cell(
r"""import numpy as np
from sklearn.metrics import f1_score

def gwet_ac1(y_true, y_pred):
    # Gwet's AC1 for binary (one-vs-rest) ratings
    n = len(y_true)
    if n == 0:
        return float('nan')
    agree = sum(t == p for t, p in zip(y_true, y_pred)) / n
    pi_k = (sum(y_true) + sum(y_pred)) / (2 * n)
    p_chance = 2 * pi_k * (1 - pi_k)
    return float('nan') if (1 - p_chance) == 0 else (agree - p_chance) / (1 - p_chance)

# ── Pair up predictions with ground truth ────────────────────────────────────
# Ground truth is indexed per highlight_id (multiple rows per highlight possible)
gt_by_hid = defaultdict(list)
for r in gt_rows:
    gt_by_hid[r['highlight_id']].append(r)

hid_export_rows = defaultdict(list)
for row in input_rows:
    hid_export_rows[row['highlight_id']].append(row)

comparison = []
for hid, exp_rows in hid_export_rows.items():
    gt_codes = gt_by_hid.get(hid, [])
    for i, exp_row in enumerate(exp_rows):
        key = cache_key(exp_row)
        gt = gt_codes[i] if i < len(gt_codes) else {}
        comparison.append({
            'highlight_id': hid,
            'gt_strategy':    gt.get('Model Strategy', '').strip(),
            'gt_motivation':  gt.get('Parent Motivation', '').strip(),
            'llm_strategy':   cache_s.get(key, {}).get('model_strategy', ''),
            'llm_motivation': cache_m.get(key, {}).get('parent_motivation', ''),
        })

valid_s = [(r['gt_strategy'],   r['llm_strategy'])
           for r in comparison
           if r['gt_strategy'] and r['llm_strategy'] not in ('PARSE_ERROR','DRY_RUN','')]
valid_m = [(r['gt_motivation'], r['llm_motivation'])
           for r in comparison
           if r['gt_motivation'] and r['llm_motivation'] not in ('PARSE_ERROR','DRY_RUN','')]

print(f"Comparable strategy pairs:   {len(valid_s)}")
print(f"Comparable motivation pairs: {len(valid_m)}")
"""
))

cells.append(code_cell(
r"""def compute_metrics(valid_pairs, label_name):
    if not valid_pairs:
        print(f"No valid pairs for {label_name}")
        return {}
    gt   = [p[0] for p in valid_pairs]
    pred = [p[1] for p in valid_pairs]
    all_codes = sorted(set(gt) | set(pred))
    results = {}
    for code in all_codes:
        yt = [1 if l == code else 0 for l in gt]
        yp = [1 if l == code else 0 for l in pred]
        ac1 = gwet_ac1(yt, yp)
        f1  = f1_score(yt, yp, zero_division=0)
        results[code] = {
            'ac1': round(ac1, 3), 'f1': round(f1, 3),
            'n_gt': sum(yt), 'n_pred': sum(yp),
            'pass': ac1 >= AC1_THRESHOLD,
        }
    exact = sum(g == p for g, p in valid_pairs) / len(valid_pairs)
    macro_f1 = f1_score(gt, pred, average='macro', zero_division=0)

    print(f"\n{'='*64}")
    print(f"{label_name}  ({len(valid_pairs)} pairs, threshold AC1 >= {AC1_THRESHOLD})")
    print(f"{'='*64}")
    print(f"{'Code':<46} {'AC1':>5} {'F1':>5} {'N_GT':>5} {'N_P':>5}  PASS")
    print("-"*64)
    for code, m in sorted(results.items(), key=lambda x: -x[1]['n_gt']):
        status = "PASS" if m['pass'] else "FAIL"
        print(f"{code:<46} {m['ac1']:>5.3f} {m['f1']:>5.3f} {m['n_gt']:>5} {m['n_pred']:>5}  {status}")
    print("-"*64)
    print(f"{'Exact match accuracy':<46} {exact:>5.3f}")
    print(f"{'Macro F1':<46} {macro_f1:>5.3f}")
    passing = sum(1 for m in results.values() if m['pass'])
    print(f"\nCodes passing: {passing}/{len(results)}")
    return results

strategy_metrics  = compute_metrics(valid_s, "Model Strategy")
motivation_metrics = compute_metrics(valid_m, "Parent Motivation")
"""
))

# ── Cell 8: Iteration Log ──────────────────────────────────────────────────────
cells.append(md_cell(
    "## Cell 8 — Iteration Log\n\n"
    "| Version | Date | Model | Changes | Strategy Pass | Motivation Pass |\n"
    "|---|---|---|---|---|---|\n"
    "| v1 | 2026-04-27 | claude-sonnet-4-6 | Initial run | TBD | TBD |\n\n"
    "**Prompt revision notes:**\n"
    "- (Update this cell after each revision cycle: which codes failed, what changed, result.)\n\n"
    "**Low-confidence codes (synthetic examples only, no pilot data):**\n"
    "- Model Strategy: Remind Model is Not Human, Defer to Parents\n"
    "- Parent Motivation: Children Could Become Overdependent, Response Confirmation / Contradiction\n\n"
    "If these codes fail AC1 >= 0.70 after 2 revision cycles, flag as **requires continued human coding**."
))

# ── Cell 9: Export ─────────────────────────────────────────────────────────────
cells.append(md_cell("## Cell 9 — Export"))
cells.append(code_cell(
r"""# Build output TSV
output_rows = []
for row in input_rows:
    key = cache_key(row)
    s_res = cache_s.get(key, {})
    m_res = cache_m.get(key, {})
    out = dict(row)
    out['llm_model_strategy']     = s_res.get('model_strategy', '')
    out['llm_parent_motivation']  = m_res.get('parent_motivation', '')
    out['llm_strategy_reasoning'] = s_res.get('reasoning', '')
    out['llm_motivation_reasoning'] = m_res.get('reasoning', '')
    output_rows.append(out)

out_tsv = OUT_DIR / "llm_coded_highlights.tsv"
fieldnames = list(input_rows[0].keys()) + [
    'llm_model_strategy', 'llm_parent_motivation',
    'llm_strategy_reasoning', 'llm_motivation_reasoning'
]
with open(out_tsv, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', extrasaction='ignore')
    writer.writeheader()
    writer.writerows(output_rows)
print(f"Saved {len(output_rows)} rows to {out_tsv}")

# Save validation report
if strategy_metrics and motivation_metrics:
    report_rows = (
        [{'dimension': 'Model Strategy',    'code': c, **m} for c, m in strategy_metrics.items()] +
        [{'dimension': 'Parent Motivation', 'code': c, **m} for c, m in motivation_metrics.items()]
    )
    report_path = OUT_DIR / "validation_report.csv"
    with open(report_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['dimension','code','ac1','f1','n_gt','n_pred','pass'])
        writer.writeheader()
        writer.writerows(report_rows)
    print(f"Saved validation report to {report_path}")

print("\nOutput directory:")
for p in sorted(OUT_DIR.iterdir()):
    print(f"  {p.name}")
"""
))

# ── Build notebook ────────────────────────────────────────────────────────────
nb = nbformat.v4.new_notebook()
nb.cells = cells
nb.metadata['kernelspec'] = {
    "display_name": "Python 3 (open-webui)",
    "language": "python",
    "name": "open-webui"
}
nb.metadata['language_info'] = {"name": "python", "version": "3.11"}

out_path = Path("stat_analysis/2_llm_coder.ipynb")
with open(out_path, 'w') as f:
    nbformat.write(nb, f)

print(f"Notebook written: {out_path}")
print(f"Cells: {len(cells)}")
