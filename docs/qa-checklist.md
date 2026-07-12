# Scaffold QA checklist

- [ ] `npm install` completes from a clean checkout.
- [ ] `npm run verify` exits successfully.
- [ ] `npm run dev` starts contracts, server, and web processes.
- [ ] `/api/health` returns a schema-valid response through Vite.
- [ ] The web page reports HTTP server `ok`.
- [ ] The web page reports Socket.IO `connected`.
- [ ] No `.env` file or credential appears in `git status`.
- [ ] The approved design and repository plan exist under `docs/superpowers/`.
