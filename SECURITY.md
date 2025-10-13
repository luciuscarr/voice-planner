# Security Guide: Keeping Your API Keys Safe

## ✅ Good News!

Your `.gitignore` file is **already properly configured** to protect your secrets:

```gitignore
.env
.env.local
.env.production
```

This means any `.env` files you create **will NOT be committed to GitHub**.

## 🔒 How It Works

### Files That ARE Safe to Commit:
- ✅ `env.example` - Template with placeholder values (no real keys)
- ✅ `client/env.production` - Public frontend environment variables only
- ✅ All your code files

### Files That Should NEVER Be Committed:
- ❌ `.env` - Contains your real API keys
- ❌ `.env.local` - Local overrides with secrets
- ❌ Any file with `OPENAI_API_KEY=sk-...` with a real key

## 🛡️ Best Practices

### 1. **Always Use env.example as a Template**

```bash
# Create your local .env from the example
cp env.example .env

# Then edit .env with your real keys (this file is gitignored)
```

### 2. **Never Hardcode API Keys**

❌ **BAD:**
```javascript
const apiKey = "sk-1234567890abcdef"; // Never do this!
```

✅ **GOOD:**
```javascript
const apiKey = process.env.OPENAI_API_KEY; // Read from environment
```

### 3. **Check Before You Commit**

Before committing, always verify:
```bash
git status              # Check what files are staged
git diff                # Review changes
```

If you see `.env` in the list, **STOP** and remove it:
```bash
git reset .env          # Unstage the file
```

### 4. **Use Environment Variables in Production**

For Railway, Render, or Vercel, add secrets via their dashboard:
- **Never** put secrets in vercel.json or railway.json
- **Always** use the platform's environment variable settings

#### Railway Example:
1. Go to your project dashboard
2. Click "Variables" tab
3. Add: `OPENAI_API_KEY` = `sk-your-key-here`
4. Deploy

#### Vercel Example:
1. Go to Project Settings → Environment Variables
2. Add: `OPENAI_API_KEY` = `sk-your-key-here`
3. Select environment (Production/Preview/Development)
4. Save and redeploy

## 🚨 What If I Accidentally Committed My API Key?

If you accidentally committed your `.env` file with real keys:

### 1. **IMMEDIATELY Revoke the Key**
- Go to [OpenAI Platform](https://platform.openai.com/api-keys)
- Delete the exposed key
- Generate a new one

### 2. **Remove from Git History**
```bash
# Remove the file from git (but keep local copy)
git rm --cached .env

# Commit the removal
git commit -m "Remove .env from tracking"

# Push to GitHub
git push
```

**Note:** This only removes it from future commits. The key is still in git history, which is why **revoking the key** is critical.

### 3. **For Complete History Cleanup (Advanced)**
If the key is in git history:
```bash
# Use git filter-branch or BFG Repo-Cleaner
# WARNING: This rewrites history and affects all collaborators

# Easier option: Create a new repository
# 1. Delete the old repo
# 2. Create a fresh repo
# 3. Copy code (not .git folder)
# 4. Initialize new git repo
```

## 🔍 How to Verify Your Keys Are Safe

### Check if .env is tracked:
```bash
git ls-files | grep .env
```
You should only see:
- `env.example`
- `client/env.production` (if it exists and has no secrets)

**You should NOT see:** `.env`, `.env.local`

### Search for exposed keys in code:
```bash
# Windows PowerShell
Get-ChildItem -Recurse -Include *.js,*.ts,*.tsx,*.json | Select-String "sk-" -CaseSensitive

# Or use grep
grep -r "sk-" --include="*.js" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

If you find any `sk-` strings, make sure they're:
1. In `.env` (gitignored)
2. In example/documentation files with placeholder text
3. NOT hardcoded in actual code

## 📋 Checklist Before Publishing

- [ ] `.env` is in `.gitignore` ✅ (Already done!)
- [ ] No `.env` files in `git status`
- [ ] No API keys hardcoded in source files
- [ ] `env.example` has placeholder values only
- [ ] Production secrets added to hosting platform dashboard
- [ ] API keys have usage limits set (in OpenAI dashboard)
- [ ] Tested that app works without secrets in code

## 🔐 Additional Security Tips

### 1. **Set API Key Usage Limits**
In your OpenAI dashboard:
- Set monthly spending limits ($5-10 for testing)
- Enable usage notifications
- Monitor usage regularly

### 2. **Use Different Keys for Dev/Prod**
- Development key: Low spending limit
- Production key: Higher limit, monitored closely

### 3. **Rotate Keys Regularly**
- Change API keys every few months
- Immediately rotate if you suspect exposure

### 4. **Use Secret Scanning Tools**
GitHub can automatically detect exposed secrets:
- Enable "Secret scanning" in repository settings
- Add `.gitleaks.toml` for additional protection

### 5. **Review Collaborator Access**
- Only give repository access to trusted collaborators
- Use branch protection rules
- Require pull request reviews

## 📚 Resources

- [GitHub's Guide to Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OpenAI Security Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [GitGuardian - Detect Secrets](https://www.gitguardian.com/)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

## ✅ Your Current Status

Based on your repository:
- ✅ `.gitignore` properly configured
- ✅ No `.env` files tracked in git
- ✅ Only safe template files (`env.example`) in repository
- ✅ Code uses environment variables (not hardcoded keys)

**You're all set!** Just remember to:
1. Never commit `.env` files
2. Add secrets via platform dashboards in production
3. Revoke and regenerate keys if ever exposed

