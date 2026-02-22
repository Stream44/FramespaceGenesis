```markdown
# Contributing to Framespace Genesis

Thank you for contributing to Framespace Genesis.

This repository enforces strong provenance and integrity guarantees. As a result, contributions must satisfy **three independent requirements**:

1. Developer Certificate of Origin (DCO)
2. Signed-off commit messages
3. Verified cryptographic commit signatures (SSH or GPG)

All three are required for CI to pass.

---

## Overview of Repository Rules

Before submitting a Pull Request, ensure that:

- You have signed the DCO agreement
- Every commit contains a `Signed-off-by:` trailer
- Every commit is cryptographically signed
- The working directory is clean when using repository scripts
- Branch protection rules may prevent force-pushes

Failing any of these will cause CI checks to fail.

---

## One-Time Setup (Required)

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
````

Verify:

```bash
bun --version
```

### 2. Configure Git Identity

Use the same email as your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## Configure Verified Commit Signing (SSH Recommended)

This repository enforces verified signatures.

### Step 1 — Enable SSH Signing in Git

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

If your key has a different name, list keys:

```bash
ls ~/.ssh/*.pub
```

### Step 2 — Configure Local Verification (Required by Git)

```bash
mkdir -p ~/.config/git
echo "$(whoami) $(cat ~/.ssh/id_ed25519.pub)" > ~/.config/git/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
```

### Step 3 — Register Your Signing Key in GitHub

Go to:
GitHub → Settings → SSH and GPG Keys → New SSH Key

Important:

* Set **Key Type** to: `Signing Key`
* Do NOT add it only as an authentication key

---

## Sign the Developer Certificate of Origin (DCO)

Sign once per repository:

```bash
bun run sign-dco
```

This records your DCO agreement in the repository.

---

## Recommended Contribution Workflow (Golden Path)

This workflow avoids history rewriting and CI failures.

```bash
git checkout -b my-feature-branch
bun install

# Make your changes
git add .
git commit -S --signoff -m "Describe your change clearly"

git push -u origin my-feature-branch
```

Then open a Pull Request.

---

## Using the Repository Push Helper

The repository provides a helper:

```bash
bun run push
```

Behaviour:

* Requires a clean working directory
* May squash unsigned commits into a signed commit
* Does NOT automatically fix missing `Signed-off-by` trailers on older commits
* Will fail if untracked or unstaged files exist

---

## Common CI Failures and Fixes

### 1. Missing Signed-off-by Trailer

Error:

```
Missing: Signed-off-by trailer
```

Fix:

```bash
git commit --amend -S --signoff --no-edit
```

---

### 2. Missing Verified Signature

Cause:

* Git signing not configured
* Signing key not registered in GitHub as a Signing Key

Fix:

* Configure SSH signing (see above)
* Amend the commit:

```bash
git commit --amend -S --no-edit
```

---

### 3. DCO Fails for Older Commits in PR

The DCO check validates **all commits between `main` and your PR head**.

Inspect commit range:

```bash
git log --oneline origin/main..HEAD
```

If any commit is missing sign-off or signature, rewrite them:

```bash
git rebase -i HEAD~N
git commit --amend -S --signoff --no-edit
git rebase --continue
```

---

### 4. Force Push Blocked by Repository Rules

This repository may block force-push on branches.

If you rewrote commit history:

```bash
git checkout -b my-branch-fixed
git push -u origin my-branch-fixed
```

Then open a new Pull Request and close the old one.

---

### 5. Working Directory Not Clean (`bun run push` fails)

Example:

```
Working directory has uncommitted changes
```

Fix options:

* Commit the files
* Stash them:

  ```bash
  git stash -u
  bun run push
  git stash pop
  ```
* Or ignore local artefacts (e.g. `bun.lock`) using:

  ```bash
  echo "bun.lock" >> .git/info/exclude
  ```

---

## Pull Request Requirements

A Pull Request will only be mergeable when:

* All CI checks pass
* DCO validation passes
* Signature verification passes
* At least one reviewer with write access approves the PR

Contributors cannot merge their own PR without external approval due to repository governance rules.

---

## Final Verification Before Opening a PR

```bash
git log -3 --show-signature
git log -3 --pretty=%B
```

Ensure:

* Each commit shows a valid signature
* Each commit contains a `Signed-off-by:` line

````
