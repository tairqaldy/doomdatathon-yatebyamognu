// AIM host adapter for the /broker demo app (#17). This is the ONLY file that knows the page the widget runs on.
// To put AIM on another page (e.g. one built from Freedom Broker's real design), either edit this file or set
// window.AIM_HOST = { ... } before loading broker/agent.js. Every field is optional: missing ones fall back to the
// generic defaults in agent.js (language from <html lang>, no typed catalog, DOM scan of the whole page).
//
//   getLang()        → 'RU' | 'KZ' | 'EN'            current UI language
//   onLang(fn)       → subscribe to language changes
//   currentScreen()  → string                        id of the screen the client is on
//   catalog()        → [{ id, title, summary?, targets: [{ id, label, kind: 'field'|'button'|'section', protected?, options? }] }]
//   go(screen)       → Promise<boolean> | boolean    open a screen from the catalog
//   findTarget(id)   → Element | null                element for a catalog target id
//   contentRoot()    → Element                       where the DOM-scan fallback looks for buttons and fields
//   compact()        → boolean (optional)            true = the app is phone-sized, so minimise AIM while it acts
//                                                    (default: viewport ≤ 860 px). Used by the /phone demo frame.
//   apiBase          → ''                            prefix for /api/agent, /api/agent-voice, /api/evaluate
//   checklistUrl     → URL of the QA checklist used after a handoff
//   keepHistory      → false (default)               true = restore the chat (messages, open panel, pending consent,
//                                                    handoff link) from sessionStorage after a reload. By default
//                                                    every fresh page load starts a clean conversation (#25).
import * as app from '/broker/app.js';

export default {
  getLang: app.getLang,
  onLang: app.onLang,
  currentScreen: app.currentScreen,
  catalog: app.catalog,
  go: app.go,
  findTarget: app.findTarget,
  contentRoot: () => document.getElementById('br-main') || document.body,
  apiBase: '',
  checklistUrl: '/data/checklists/freedom-chat-v1.json',
};
