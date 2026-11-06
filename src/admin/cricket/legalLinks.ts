// RunMitra's website (the runmitra-website project, on www.runmitra.in; the
// app itself is app.runmitra.in): the policies Google Play asks the app to
// link to, and how deleting an account works.
const WEBSITE = "https://www.runmitra.in";

export const PRIVACY_URL = `${WEBSITE}/privacy`;
export const TERMS_URL = `${WEBSITE}/terms`;
export const DELETE_ACCOUNT_URL = `${WEBSITE}/delete-account`;

// A new tab on the website; the phone's browser in the Android app.
export const openWebsite = (url: string) => window.open(url, "_blank", "noopener");
