# React2Shell Security Upgrade - Post-Deployment Checklist

## ✅ Completed Automatically
- [x] Updated Next.js from 16.0.0 to 16.0.10
- [x] Updated eslint-config-next to 16.0.10
- [x] Installed patched dependencies
- [x] Verified build passes
- [x] Committed changes to git

## 🔒 Manual Steps Required (After Deployment)

### 1. Rotate Environment Variables
**CRITICAL**: Rotate all secrets after deployment, especially if your app was online and unpatched as of December 4, 2025.

**Required rotations:**
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Any other sensitive environment variables

**How to rotate:**
1. Visit Vercel Dashboard → Your Project → Settings → Environment Variables
2. For each secret:
   - Generate a new value
   - Update the environment variable in Vercel
   - Update any external services that use these keys
   - Test that the application still works with new keys

**Documentation**: https://vercel.com/docs/environment-variables/rotating-secrets

### 2. Enable Deployment Protection
**Action Required**: Enable Standard Protection for all non-production deployments.

**Steps:**
1. Visit Vercel Dashboard → Your Project → Settings → Deployment Protection
2. Enable Standard Protection for:
   - Preview deployments
   - Development deployments
   - Staging deployments
3. **Do NOT** enable for production domain (users need access)
4. Review and audit shareable links from all deployments

**Documentation**: https://vercel.com/docs/deployment-protection

### 3. Verify Protection
After deployment, verify:
- [ ] Check Vercel dashboard - security banner should be gone
- [ ] Verify production deployment shows Next.js 16.0.10
- [ ] Confirm WAF rules are active (automatic on Vercel)
- [ ] Test that application functions correctly

## Deployment Instructions

To deploy the patched version:

```bash
# Push to trigger automatic deployment
git push

# Or deploy manually with Vercel CLI
vercel --prod
```

## Rollback Plan

If issues occur after deployment:

1. Revert package.json:
   ```bash
   git revert HEAD
   npm install
   git push
   ```

2. Or manually revert in Vercel dashboard to previous deployment

## Additional Resources

- [Next.js Security Advisory](https://nextjs.org/blog/CVE-2025-66478)
- [React Security Advisory](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [Vercel Security Bulletin](https://vercel.com/kb/bulletin/security-bulletin-react2shell)

