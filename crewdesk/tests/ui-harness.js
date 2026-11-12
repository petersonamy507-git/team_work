// Paste into the browser console on http://localhost:5180 (signed in), then run steps with T.step(name, async () => {...}).
window.T = (() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (e) => e && e.offsetParent !== null
  const txt = (e) => (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ')
  const log = []
  async function go(path) { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); await sleep(1100) }
  function find(text, sel = 'button,a,[role=tab]', exact = true) {
    const els = [...document.querySelectorAll(sel)].filter(vis)
    return els.find((e) => (exact ? txt(e) === text : txt(e).includes(text))) || (exact ? els.find((e) => txt(e).startsWith(text)) : null)
  }
  async function click(text, opts = {}) {
    const scope = opts.modal ? [...document.querySelectorAll('.modal')].pop() : document
    const els = [...scope.querySelectorAll(opts.sel || 'button,a,[role=tab]')].filter(vis)
    const e = els.find((x) => txt(x) === text) || els.find((x) => txt(x).startsWith(text)) || (opts.loose && els.find((x) => txt(x).includes(text)))
    if (!e) throw new Error(`no clickable "${text}"`)
    e.click(); await sleep(opts.wait || 500); return e
  }
  function setVal(el, v) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }
  async function fill(label, v) {
    const m = [...document.querySelectorAll('.modal')].pop() || document
    const f = [...m.querySelectorAll('.field')].find((x) => txt(x.querySelector('label') || x).startsWith(label))
    if (!f) throw new Error(`no field "${label}"`)
    const el = f.querySelector('input,textarea,select')
    if (el.tagName === 'SELECT' && v === '*first') v = [...el.options].find((o) => o.value)?.value
    if (el.type === 'checkbox') { if (el.checked !== !!v) el.click() } else setVal(el, String(v))
    await sleep(150)
  }
  const has = (s) => document.body.innerText.includes(s)
  const modalOpen = () => !!document.querySelector('.modal')
  async function step(name, fn) {
    try { await fn(); log.push(`PASS ${name}`) } catch (e) { log.push(`FAIL ${name}: ${e.message}`); document.querySelectorAll('.modal .icon-btn').forEach((b) => b.click()); await sleep(300) }
  }
  async function expect(cond, msg) { for (let i = 0; i < 12; i++) { if (cond()) return; await sleep(250) } throw new Error(msg) }
  const api = async (m, u, b) => { const r = await fetch('/api' + u, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('crewdesk_token') }, body: b ? JSON.stringify(b) : undefined }); return r.json() }
  return { sleep, go, click, fill, has, step, expect, log, api, modalOpen, find, txt, setVal }
})(); 'ok'
