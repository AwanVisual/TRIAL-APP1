# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/b7de1e5b-ea65-4760-8ef7-f7063784da24

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b7de1e5b-ea65-4760-8ef7-f7063784da24) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Midtrans Payment Gateway

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b7de1e5b-ea65-4760-8ef7-f7063784da24) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Midtrans Payment Gateway Setup

This application includes Midtrans payment gateway integration for transfer payments. To set it up:

1. **Get Midtrans Account**
   - Sign up at [Midtrans](https://midtrans.com/)
   - Get your Server Key and Client Key from the dashboard

2. **Environment Variables**
   Add these to your `.env` file:
   ```
   MIDTRANS_SERVER_KEY=your_server_key_here
   MIDTRANS_CLIENT_KEY=your_client_key_here
   ```

3. **Backend API Required**
   You'll need to create a backend API endpoint at `/api/midtrans/create-transaction` that:
   - Receives transaction details from the frontend
   - Calls Midtrans API with your server key
   - Returns the payment methods and transaction token

4. **Payment Flow**
   - Customer selects "Transfer" payment method
   - Clicks "Use Midtrans" button
   - Selects preferred payment method (VA, e-wallet, etc.)
   - Completes payment through Midtrans
   - Transaction is automatically processed

For development, the integration uses sandbox mode. Switch to production mode by updating the `isProduction` flag in `src/lib/midtrans.ts`.
