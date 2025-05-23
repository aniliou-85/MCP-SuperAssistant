# System Commands and Utilities

## Git Commands:
```bash
# Standard git operations
git status
git add <files>
git commit -m "message"
git push
git pull
git branch
git checkout <branch>
git merge <branch>

# View git log
git log --oneline
git log --graph --oneline --all
```

## File Operations:
```bash
# List files and directories
ls -la
ls -lah  # with human-readable sizes

# Find files
find . -name "*.ts" -type f
find . -path "*/node_modules" -prune -o -name "*.json" -print

# Search in files
grep -r "search_term" .
grep -r "search_term" --include="*.ts" .
grep -rn "search_term" src/  # with line numbers

# File manipulation
cp source destination
mv source destination
rm filename
rm -rf directory/
mkdir -p path/to/directory
```

## Process and System:
```bash
# Process management
ps aux
ps aux | grep node
kill -9 <PID>
killall node

# System info
uname -a
df -h  # disk space
free -h  # memory usage
top    # process monitor
htop   # better process monitor (if available)
```

## Network:
```bash
# Check ports
netstat -tulpn
lsof -i :3000  # check specific port

# Test connectivity
ping google.com
curl -I https://example.com
wget https://example.com/file
```

## Text Processing:
```bash
# View file contents
cat filename
less filename
head -n 20 filename
tail -n 20 filename
tail -f logfile  # follow log file

# Text manipulation
sort filename
uniq filename
wc -l filename  # count lines
sed 's/old/new/g' filename
awk '{print $1}' filename
```

## Archive Operations:
```bash
# Create archives
tar -czf archive.tar.gz directory/
zip -r archive.zip directory/

# Extract archives
tar -xzf archive.tar.gz
unzip archive.zip
```

## Node.js/JavaScript Specific:
```bash
# Node version management
node --version
npm --version
pnpm --version

# Check global packages
pnpm list -g --depth=0

# Clear npm/pnpm cache
pnpm store prune
npm cache clean --force

# Check package info
pnpm info <package-name>
pnpm outdated
```

## Development Utilities:
```bash
# Watch file changes
watch -n 1 'command'

# Monitor directory changes
inotifywait -m -r -e modify,create,delete directory/

# JSON manipulation
cat file.json | jq '.'
cat file.json | jq '.key'

# Environment variables
env
printenv
export VAR_NAME=value
```

## Package-specific Operations:
```bash
# pnpm workspace commands
pnpm -r <command>  # run in all packages
pnpm -F <package> <command>  # run in specific package
pnpm list --depth=0  # show direct dependencies

# Turbo commands
turbo <task>
turbo <task> --dry-run
turbo <task> --force
```

## Chrome Extension Development:
```bash
# Load extension for testing
# (Manual: chrome://extensions/ -> Load unpacked)

# Check extension logs
# (Manual: Chrome DevTools -> Console in extension context)

# Reload extension
# (Manual: chrome://extensions/ -> Reload button)
```

## Troubleshooting:
```bash
# Check disk space
du -sh directory/  # directory size
du -sh * | sort -rh  # largest directories first

# Check permissions
ls -la filename
chmod +x script.sh
chown user:group filename

# Service management (if applicable)
systemctl status service-name
systemctl restart service-name
```

Note: This is a Linux system, so commands are Linux-specific. Some macOS equivalents may differ.