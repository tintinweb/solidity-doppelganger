#!/env/python3
import subprocess
import os
import glob


def shell(cmd, cwd):
    return subprocess.check_output(cmd, shell=True, cwd=cwd).decode().strip()

def runForDir(cwd, modes):
    tags = shell("git tag", cwd=cwd).strip().split()
    if not tags:
        tags = shell("git rev-parse HEAD", cwd).strip().split()


    if not tags:
        return
    outfile = cwd.split("/")[1]
    with open(outfile+".json", "w") as f:
        for tag in tags:
            shell("git checkout " + tag, cwd)
            remote = shell("git config --get remote.origin.url", cwd).replace(".git","") + "/blob/" + tag 

            cmd = "node ../../src/cli.js -p -b " + remote + " -m AST_EXACT,AST_STRUCTURE " + "**/*.sol *.sol" 
            ret = shell(cmd, cwd)
            f.write(ret + "\n")
            shell("git reset --hard", cwd)

def runAllDirs():
    d = "."
    for dir in [os.path.join(d, o) for o in os.listdir(d) if os.path.isdir(os.path.join(d,o))]:
        runForDir(dir, ["AST_EXACT", "AST_STRUCTURE"])

if __name__=="__main__":
    runAllDirs()