// Data Structures (REALMS, TRAITS, PREGEN, SPELL_RANKS are in data.js)

const PORTRAITS = [
    'portraits/ariel.png',
    'portraits/belit.png',
    'portraits/bianka.png',
    'portraits/bladud.png',
    'portraits/corax.png',
    'portraits/freya.png',
    'portraits/gayn.png',
    'portraits/grendel.png',
    'portraits/horus.png',
    'portraits/jafar.png',
    'portraits/kali.png',
    'portraits/lopan.png',
    'portraits/merlin.png',
    'portraits/morique.png',
    'portraits/nineseven.png',
    'portraits/oberic.png',
    'portraits/queen_xarxla.png',
    'portraits/raass.png',
    'portraits/raven.png',
    'portraits/rjak.png',
    'portraits/sharee.png',
    'portraits/sir_horatio.png',
    'portraits/sssra.png',
    'portraits/tauron.png',
    'portraits/tlachtga.jpg',
    'portraits/tlaloc.png'
];

// State
let state = {
    name: '',
    portraitIdx: 0,
    spellbooks: { nature: 0, sorcery: 0, chaos: 0, life: 0, death: 0 },
    traits: [], // array of id strings
    maxPicks: 11
};

let saves = JSON.parse(localStorage.getItem('mom_wizards') || '[]');
if (saves.length > 0 && saves[0].retorts !== undefined) {
    saves = [];
    localStorage.setItem('mom_wizards', '[]');
}

// DOM Elements
const elPicks = document.getElementById('picks-counter');
const elSaveBtn = document.getElementById('btn-save');
const elPortrait = document.getElementById('wizard-portrait');
const elName = document.getElementById('wizard-name');

// -----------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------
function init() {
    renderSpellbooks();
    renderTraits();
    updateUI();
    renderSaves();
    renderPregen();
    
    setupModal();
    checkDisclaimer();

    // Event Listeners
    document.getElementById('nav-editor').addEventListener('click', () => switchView('editor'));
    document.getElementById('nav-saves').addEventListener('click', () => switchView('saves'));
    document.getElementById('nav-defaults').addEventListener('click', () => switchView('defaults'));
    
    document.getElementById('portrait-prev').addEventListener('click', () => cyclePortrait(-1));
    document.getElementById('portrait-next').addEventListener('click', () => cyclePortrait(1));
    
    elName.addEventListener('input', (e) => {
        state.name = e.target.value;
        updateSaveButtonState();
    });

    document.getElementById('max-picks-select').addEventListener('change', (e) => {
        state.maxPicks = parseInt(e.target.value);
        updateUI();
    });

    elSaveBtn.addEventListener('click', saveWizard);
    
    // Scroll Top logic
    const btnTop = document.getElementById('btn-scroll-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btnTop.classList.remove('hidden');
        } else {
            btnTop.classList.add('hidden');
        }
    });
    btnTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// -----------------------------------------------------------------
// LOGIC
// -----------------------------------------------------------------
function getPicksSpent() {
    let spent = 0;
    // Count spellbooks (1 each)
    for (let realm in state.spellbooks) {
        spent += state.spellbooks[realm];
    }
    // Count traits
    state.traits.forEach(rid => {
        const trait = TRAITS.find(t => t.id === rid);
        if (trait) spent += trait.cost;
    });
    return spent;
}

function updateUI() {
    // Check if any active traits fail reqs and auto-remove them
    let traitRemoved = false;
    for (let i = state.traits.length - 1; i >= 0; i--) {
        const tid = state.traits[i];
        const t = TRAITS.find(tr => tr.id === tid);
        if (t && t.req && !t.req(state)) {
            state.traits.splice(i, 1);
            traitRemoved = true;
        }
    }
    if (traitRemoved) { 
        return updateUI(); 
    }

    const spent = getPicksSpent();
    const remaining = state.maxPicks - spent;
    
    // Update counter
    elPicks.textContent = remaining;
    if (remaining < 0) {
        elPicks.style.color = 'var(--acc-color-red)';
    } else if (remaining === 0) {
        elPicks.style.color = '#fff';
    } else {
        elPicks.style.color = 'var(--acc-color-green)';
    }

    // Update Spellbook UI
    REALMS.forEach(realm => {
        const val = state.spellbooks[realm.id];
        document.getElementById(`val-${realm.id}`).textContent = val;
        
        // Update inline spell details
        const detailElem = document.getElementById(`details-${realm.id}`);
        if (detailElem) {
            if (val > 0) {
                const rank = SPELL_RANKS.find(r => parseInt(r.books) === val);
                if (rank) {
                    let text = `${rank.common} com`;
                    if (rank.uncommon && rank.uncommon !== 'none') text += `, ${rank.uncommon} unc`;
                    if (rank.rare && rank.rare !== 'none') text += `, ${rank.rare} rare`;
                    if (rank.veryRare && rank.veryRare !== 'none') text += `, ${rank.veryRare} v.rare`;
                    detailElem.textContent = text;
                }
            } else {
                detailElem.textContent = "";
            }
        }
        
        const btnMinus = document.getElementById(`minus-${realm.id}`);
        const btnPlus = document.getElementById(`plus-${realm.id}`);
        const card = document.getElementById(`card-${realm.id}`);
        
        btnMinus.disabled = val <= 0;
        
        // Mutually exclusive Life/Death
        let isDisabled = false;
        if (realm.id === 'life' && state.spellbooks.death > 0) isDisabled = true;
        if (realm.id === 'death' && state.spellbooks.life > 0) isDisabled = true;
        
        if (isDisabled) {
            btnPlus.disabled = true;
            btnMinus.disabled = true;
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
            btnPlus.disabled = remaining <= 0; // limit by total points
        }
    });

    // Update Traits UI
    TRAITS.forEach(t => {
        const card = document.getElementById(`trait-${t.id}`);
        // Add a check in case the trait ID does not exist securely yet
        if (!card) return;
        const isActive = state.traits.includes(t.id);
        const reqPasses = t.req ? t.req(state) : true;
        const limitReached = state.traits.length >= 6 && !isActive;
        
        if (isActive) {
            card.className = 'trait-card active';
        } else {
            if (!reqPasses) {
                card.className = 'trait-card disabled req-fail';
            } else if (remaining < t.cost || limitReached) {
                card.className = 'trait-card disabled';
            } else {
                card.className = 'trait-card';
            }
        }
    });
    
    updateWizardSummary();
    updateSaveButtonState();
}

function updateSaveButtonState() {
    const remaining = state.maxPicks - getPicksSpent();
    const hasName = state.name.trim().length > 0;
    // Allow saving if name exists and points are exactly 0 (or we can allow saving partials, let's allow saving valid combinations 11 points used)
    elSaveBtn.disabled = !hasName || remaining < 0; // || remaining > 0 (Wait, in standard MoM you don't HAVE to spend all points)
}

function toggleTrait(id) {
    const t = TRAITS.find(tr => tr.id === id);
    const cost = t.cost;
    const remaining = state.maxPicks - getPicksSpent();
    const idx = state.traits.indexOf(id);
    const reqPasses = t.req ? t.req(state) : true;
    
    if (idx >= 0) {
        // Remove it
        state.traits.splice(idx, 1);
    } else {
        // Add it if points allow, reqs pass, and we haven't reached the 6-trait limit
        if (remaining >= cost && reqPasses && state.traits.length < 6) {
            state.traits.push(id);
        }
    }
    updateUI();
}

function adjustBook(realmId, delta) {
    const current = state.spellbooks[realmId];
    const newAmount = current + delta;
    const remaining = state.maxPicks - getPicksSpent();
    
    if (delta > 0 && remaining < delta) return;
    if (newAmount < 0) return;
    
    // Restriction check
    if (realmId === 'life' && state.spellbooks.death > 0) return;
    if (realmId === 'death' && state.spellbooks.life > 0) return;
    
    state.spellbooks[realmId] = newAmount;
    updateUI();
}

function updateWizardSummary() {
    const section = document.getElementById('wizard-summary-section');
    const content = document.getElementById('wizard-summary-content');
    
    let pills = [];
    
    // Realms
    REALMS.forEach(r => {
        const count = state.spellbooks[r.id];
        if (count > 0) {
            pills.push(`
                <div class="summary-pill">
                    <span class="${r.class}">${r.name} - ${count}</span>
                </div>
            `);
        }
    });
    
    // Traits
    state.traits.forEach(tid => {
        const trait = TRAITS.find(t => t.id === tid);
        if (trait) {
            pills.push(`
                <a href="#trait-anchor-${trait.id}" class="summary-pill trait-pill">
                    <span>${trait.name}</span>
                    <span class="cost">${trait.cost}</span>
                </a>
            `);
        }
    });
    
    if (pills.length > 0) {
        section.classList.remove('hidden');
        content.innerHTML = pills.join('');
    } else {
        section.classList.add('hidden');
        content.innerHTML = '';
    }
}

function cyclePortrait(dir) {
    state.portraitIdx += dir;
    if (state.portraitIdx < 0) state.portraitIdx = PORTRAITS.length - 1;
    if (state.portraitIdx >= PORTRAITS.length) state.portraitIdx = 0;
    elPortrait.src = PORTRAITS[state.portraitIdx];
}

function setPortrait(idx) {
    state.portraitIdx = idx;
    elPortrait.src = PORTRAITS[state.portraitIdx];
}

// -----------------------------------------------------------------
// RENDERING UI
// -----------------------------------------------------------------
function renderSpellbooks() {
    const container = document.getElementById('spellbooks-container');
    container.innerHTML = '';
    
    REALMS.forEach(realm => {
        const div = document.createElement('div');
        div.className = 'spellbook-card';
        div.id = `card-${realm.id}`;
        
        div.innerHTML = `
            <div class="realm-name ${realm.class}">
                ${realm.name}
                <button class="info-btn" onclick="showRealmInfo('${realm.id}')">?</button>
            </div>
            <div class="realm-controls">
                <button class="ctrl-btn" id="minus-${realm.id}">-</button>
                <span class="level-val" id="val-${realm.id}">0</span>
                <button class="ctrl-btn" id="plus-${realm.id}">+</button>
            </div>
            <div class="spell-details-inline" id="details-${realm.id}"></div>
        `;
        container.appendChild(div);
        
        document.getElementById(`minus-${realm.id}`).addEventListener('click', () => adjustBook(realm.id, -1));
        document.getElementById(`plus-${realm.id}`).addEventListener('click', () => adjustBook(realm.id, 1));
    });
}

function renderTraits() {
    const container = document.getElementById('traits-container');
    container.innerHTML = '';
    
    TRAITS.forEach(t => {
        const div = document.createElement('div');
        div.className = 'trait-card';
        div.id = `trait-${t.id}`;
        
        // Add anchor wrapper or ID for navigation
        const anchor = document.createElement('div');
        anchor.id = `trait-anchor-${t.id}`;
        anchor.style.position = 'absolute';
        anchor.style.marginTop = '-120px'; // Offset for sticky header
        
        div.appendChild(anchor);
        
        div.innerHTML = `
            <div class="trait-info">
                <div class="trait-header">
                    <span class="trait-name">${t.name}</span>
                    <span class="trait-cost">${t.cost} pick${t.cost === 1 ? '' : 's'}</span>
                </div>
                <div class="trait-desc">${t.desc}</div>
            </div>
            <div class="trait-checkbox"></div>
        `;
        
        div.addEventListener('click', () => toggleTrait(t.id));
        container.appendChild(div);
    });
}

// -----------------------------------------------------------------
// SAVES AND STATE MANAGEMENT 
// -----------------------------------------------------------------
function saveWizard() {
    const isNew = !state.id;
    const saveId = state.id || Date.now().toString();
    const wiz = {
        id: saveId,
        name: state.name.trim(),
        portraitIdx: state.portraitIdx,
        spellbooks: { ...state.spellbooks },
        traits: [...state.traits],
        maxPicks: state.maxPicks,
        timestamp: new Date().toISOString()
    };
    
    // Check if updating
    if (isNew) {
        state.id = saveId; // Now editing the saved version
        saves.push(wiz);
    } else {
        const existingIdx = saves.findIndex(s => s.id === state.id);
        if (existingIdx >= 0) {
            saves[existingIdx] = wiz;
        } else {
            saves.push(wiz);
        }
    }
    
    localStorage.setItem('mom_wizards', JSON.stringify(saves));
    showToast();
    renderSaves();
}

function loadWizard(wizardObj) {
    state = {
        id: wizardObj.id, // track id for updating
        name: wizardObj.name,
        portraitIdx: wizardObj.portraitIdx,
        spellbooks: { ...wizardObj.spellbooks },
        traits: [...(wizardObj.traits || [])],
        maxPicks: wizardObj.maxPicks || 11
    };
    // Ensure all spellbooks exist
    REALMS.forEach(r => {
        if (state.spellbooks[r.id] === undefined) state.spellbooks[r.id] = 0;
    });
    
    elName.value = state.name;
    document.getElementById('max-picks-select').value = state.maxPicks;
    setPortrait(state.portraitIdx);
    updateUI();
    switchView('editor');
}

window.resetEditor = function() {
    state = {
        id: null,
        name: '',
        portraitIdx: 0,
        spellbooks: {},
        traits: [],
        maxPicks: 11
    };
    
    REALMS.forEach(r => state.spellbooks[r.id] = 0);
    
    elName.value = '';
    document.getElementById('max-picks-select').value = '11';
    setPortrait(0);
    updateUI();
    switchView('editor');
}

function deleteWizard(id) {
    saves = saves.filter(s => s.id !== id);
    localStorage.setItem('mom_wizards', JSON.stringify(saves));
    renderSaves();
}

function generateSaveCardHTML(wiz, isPregen = false) {
    let magicSummary = [];
    REALMS.forEach(r => {
        if (wiz.spellbooks[r.id] > 0) {
            magicSummary.push(`<span class="${r.class}">${r.name} ${wiz.spellbooks[r.id]}</span>`);
        }
    });
    (wiz.traits || []).forEach(rid => {
        const trait = TRAITS.find(t => t.id === rid);
        if (trait) magicSummary.push(`<span>${trait.name}</span>`);
    });
    
    const pSrc = PORTRAITS[wiz.portraitIdx] || PORTRAITS[0];
    
    let actionsHTML = '';
    if (!isPregen) {
        actionsHTML = `
            <div class="wizard-actions">
                <button class="btn-small" onclick="loadWizardFromSaves('${wiz.id}')">Load</button>
                <button class="btn-small danger" onclick="deleteWizardFromSaves('${wiz.id}')">Del</button>
            </div>
        `;
    } else {
        actionsHTML = `
            <div class="wizard-actions">
                <button class="btn-small" onclick='loadPregen(${JSON.stringify(wiz).replace(/'/g, "&#39;")})'>Use</button>
            </div>
        `;
    }

    return `
        <div class="wizard-save-card">
            <img class="wizard-save-portrait" src="${pSrc}" alt="Portrait">
            <div class="wizard-save-info">
                <div class="wizard-save-name">${wiz.name}</div>
                <div class="wizard-save-stats">
                    ${magicSummary.join('')}
                </div>
            </div>
            ${actionsHTML}
        </div>
    `;
}

function renderSaves() {
    const container = document.getElementById('saved-wizards-list');
    if (saves.length === 0) {
        container.innerHTML = '<p class="section-note">No saved wizards yet.</p>';
    } else {
        container.innerHTML = saves.map(wiz => generateSaveCardHTML(wiz, false)).join('');
    }
}

function renderPregen() {
    const container = document.getElementById('classics-wizards-list');
    container.innerHTML = PREGEN.map(wiz => generateSaveCardHTML(wiz, true)).join('');
}

// Global hooks for onclick handlers
window.loadWizardFromSaves = function(id) {
    const wiz = saves.find(s => s.id === id);
    if (wiz) loadWizard(wiz);
}

window.deleteWizardFromSaves = function(id) {
    if (confirm('Delete this wizard?')) {
        deleteWizard(id);
    }
}

window.loadPregen = function(wiz) {
    // Clone it without an ID so it saves as new
    const clone = { ...wiz };
    delete clone.id;
    // ensure full structure
    for(let r of REALMS) {
        if(clone.spellbooks[r.id] === undefined) clone.spellbooks[r.id] = 0;
    }
    loadWizard(clone);
}

// -----------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.getElementById(`nav-${viewName}`).classList.add('active');
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Modal Logic
function setupModal() {
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('info-modal').classList.add('hidden');
    });
    document.getElementById('info-modal').addEventListener('click', (e) => {
        if (e.target.id === 'info-modal') {
            e.target.classList.add('hidden');
        }
    });
    
    document.getElementById('btn-spell-ranks').addEventListener('click', showSpellRanks);
}

window.showRealmInfo = function(realmId) {
    const realm = REALMS.find(r => r.id === realmId);
    if (!realm) return;
    
    document.getElementById('modal-title').textContent = realm.name + ' Magic';
    document.getElementById('modal-body').innerHTML = `<p>${realm.desc}</p>`;
    document.getElementById('info-modal').classList.remove('hidden');
};

function showSpellRanks() {
    document.getElementById('modal-title').textContent = 'Spell Ranks';
    
    let rowsHTML = SPELL_RANKS.map(r => `
        <tr>
            <td>${r.books}</td>
            <td>${r.common}</td>
            <td>${r.uncommon}</td>
            <td>${r.rare}</td>
            <td>${r.veryRare}</td>
            <td>${r.guaranteed}</td>
        </tr>
    `).join('');

    const tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Books</th>
                    <th>Com.</th>
                    <th>Unc.</th>
                    <th>Rare</th>
                    <th>VRare</th>
                    <th>Guaranteed</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
        <p class="section-note" style="margin-top: 1rem;">
            * At higher levels in a category (8+ books), wizards gain expertise reducing research/cast costs.
        </p>
    `;
    
    document.getElementById('modal-body').innerHTML = tableHTML;
    document.getElementById('info-modal').classList.remove('hidden');
}

// Disclaimer Logic
function checkDisclaimer() {
    const isHidden = localStorage.getItem('mom_disclaimer_hidden');
    if (isHidden !== 'true') {
        document.getElementById('disclaimer-modal').classList.remove('hidden');
    }
    
    document.getElementById('btn-disclaimer-ok').addEventListener('click', () => {
        const shouldHide = document.getElementById('disclaimer-hide-check').checked;
        if (shouldHide) {
            localStorage.setItem('mom_disclaimer_hidden', 'true');
        }
        document.getElementById('disclaimer-modal').classList.add('hidden');
    });
}

// Start
init();
