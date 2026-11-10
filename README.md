<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7ddb9025-2f9b-40be-9d1a-87ed65a2598a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## AI Audiology Interpretation

The AI report is an aid for interpreting audiology measurements, not a medical
diagnosis. It reports calculated PTA and test cross-checks, flags missing or
discordant values, and requires review by an audiologist/ENT. Patient names,
contact details, visit dates, and free-text notes are excluded from AI requests;
measurements and limited demographic context are sent to the selected AI provider.
No-key provider availability and the actual model served can vary.

If an AI provider is unavailable or offline, the app generates a local
rule-based audiology report from the visit's recorded AC/BC thresholds,
tympanometry, speech scores, and acoustic reflexes. The report is labeled
`LOCAL RULE-BASED`; it does not call an AI service or claim a definitive diagnosis.

## Firebase License Activation

The app connects to the `star-1991` Firebase project. Add each activation key as a
document in the Firestore `activation_keys` collection, using the exact key as the
document ID. For example:

```json
{
  "plan": "yearly",
  "days": 365,
  "isUsed": false,
  "active": true
}
```

`plan` can be `monthly`, `yearly`, or `lifetime`; `days` is optional. Publish the
Firestore rules before testing activation:

`firebase deploy --only firestore:rules --project star-1991`
