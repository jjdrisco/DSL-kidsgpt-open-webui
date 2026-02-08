#!/usr/bin/env python3
"""
Runtime dependency checker and installer.
This script attempts to import the main application module and automatically
installs any missing dependencies that are in requirements.txt.
"""
import sys
import subprocess
import importlib.util

def get_requirements_packages():
    """Read packages from requirements.txt"""
    packages = []
    try:
        with open('/app/backend/requirements.txt', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    # Extract package name (before ==, >=, <=, etc.)
                    package_name = line.split('==')[0].split('>=')[0].split('<=')[0].split('[')[0].strip()
                    if package_name:
                        packages.append((package_name, line.strip()))
    except Exception as e:
        print(f"Warning: Could not read requirements.txt: {e}")
    return dict(packages)

def install_package(package_spec):
    """Install a package using pip"""
    try:
        print(f"Installing {package_spec}...")
        subprocess.check_call([
            sys.executable, '-m', 'pip', 'install', '--no-cache-dir', package_spec
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to install {package_spec}: {e}")
        return False

def check_and_install_missing():
    """Try to import the main module and install missing dependencies"""
    requirements = get_requirements_packages()
    max_attempts = 3
    attempt = 0
    
    while attempt < max_attempts:
        attempt += 1
        print(f"\n=== Dependency check attempt {attempt}/{max_attempts} ===")
        
        try:
            # Try to import the main module
            spec = importlib.util.spec_from_file_location(
                "open_webui.main",
                "/app/backend/open_webui/main.py"
            )
            if spec is None:
                print("ERROR: Could not load main.py")
                return False
            
            # This will trigger all imports and reveal missing modules
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            print("✓ All dependencies satisfied!")
            return True
            
        except ModuleNotFoundError as e:
            missing_module = str(e).split("'")[1] if "'" in str(e) else str(e).split('"')[1] if '"' in str(e) else None
            
            if missing_module:
                print(f"Missing module: {missing_module}")
                
                # Try to find the package in requirements.txt
                package_spec = None
                for req_name, req_spec in requirements.items():
                    if req_name.lower().replace('-', '_') == missing_module.lower().replace('-', '_'):
                        package_spec = req_spec
                        break
                    # Also check if the module name matches the package name
                    if missing_module.lower() in req_name.lower() or req_name.lower() in missing_module.lower():
                        package_spec = req_spec
                        break
                
                if package_spec:
                    if install_package(package_spec):
                        continue  # Retry import
                    else:
                        print(f"Failed to install {package_spec}, trying package name only...")
                        if install_package(missing_module):
                            continue
                else:
                    # Try installing by module name
                    print(f"Package not found in requirements.txt, trying to install {missing_module}...")
                    if install_package(missing_module):
                        continue
            
            print(f"ERROR: Could not resolve missing dependency: {e}")
            if attempt >= max_attempts:
                return False
                
        except Exception as e:
            print(f"ERROR during import check: {e}")
            import traceback
            traceback.print_exc()
            if attempt >= max_attempts:
                return False
    
    return False

if __name__ == '__main__':
    success = check_and_install_missing()
    sys.exit(0 if success else 1)
