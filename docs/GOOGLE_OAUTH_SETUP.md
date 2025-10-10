# Google OAuth Setup for ImgGo

## Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure OAuth consent screen:
   - User Type: **External**
   - App name: **ImgGo**
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `email` and `profile`
   - Save and Continue

6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: **ImgGo Production**
   - Authorized redirect URIs:

     ```plaintext
     https://bgdlalagnctabfiyimpt.supabase.co/auth/v1/callback
     http://localhost:54321/auth/v1/callback (for local testing)
     ```

   - Click **Create**
   - **SAVE** the Client ID and Client Secret

## Step 2: Supabase Dashboard Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **bgdlalagnctabfiyimpt**
3. Navigate to **Authentication** → **Providers**
4. Find **Google** provider
5. Enable Google provider
6. Paste:
   - **Client ID**: (from Step 1)
   - **Client Secret**: (from Step 1)
7. **Save**

## Step 3: Update .env File

Add to your `.env.local` (already in `.env` for this project):

```bash
NEXT_PUBLIC_SUPABASE_URL="https://bgdlalagnctabfiyimpt.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

## Step 4: Test OAuth Flow

1. Start dev server: `npm run dev`
2. Navigate to `/auth/signin`
3. Click **Sign in with Google**
4. Authorize app
5. Should redirect back to app with session

## Callback URL Format

```plaintext
https://{PROJECT_REF}.supabase.co/auth/v1/callback
```

For this project:

```plaintext
https://bgdlalagnctabfiyimpt.supabase.co/auth/v1/callback
```

## Troubleshooting

### "Redirect URI mismatch"

- Make sure the redirect URI in Google Cloud Console **exactly** matches Supabase callback URL
- No trailing slashes
- Must be HTTPS in production

### "Access blocked: This app's request is invalid"

- OAuth consent screen not properly configured
- Make sure app is in "Production" or add yourself as test user

### Session not persisting

- Check browser cookies are enabled
- Check Supabase URL and anon key are correct in `.env`

## Security Notes

- **Never commit** Client Secret to Git
- Store in Supabase Dashboard only
- Client ID is public and safe to expose
- Anon key is public (protected by RLS)
