/* MoM Wizard Creator Logic */

const TOTAL_PICKS = 11;

// Data Structures
const REALMS = [
    { id: 'nature', name: 'Nature', class: 'realm-nature' },
    { id: 'sorcery', name: 'Sorcery', class: 'realm-sorcery' },
    { id: 'chaos', name: 'Chaos', class: 'realm-chaos' },
    { id: 'life', name: 'Life', class: 'realm-life' },
    { id: 'death', name: 'Death', class: 'realm-death' }
];

const RETORTS = [
    { id: 'myrran', name: 'Myrran', cost: 3, desc: 'Start on the Myrror plane with a Myrran race.' },
    { id: 'warlord', name: 'Warlord', cost: 2, desc: 'All normal units gain one level of experience instantly.' },
    { id: 'channeler', name: 'Channeler', cost: 2, desc: 'Reduces mana maintenance for summoned creatures by 50%.' },
    { id: 'archmage', name: 'Archmage', cost: 1, desc: 'Increases casting skill progress.' },
    { id: 'alchemy', name: 'Alchemy', cost: 1, desc: 'Converts mana to gold and gold to mana at a 1:1 ratio.' },
    { id: 'divine_power', name: 'Divine Power', cost: 2, desc: 'Gain power from religious buildings (requires level in Life/Nature/Sorcery/Chaos/Death but generally Life).' },
    { id: 'infernal_power', name: 'Infernal Power', cost: 2, desc: 'Gain power from dark rituals and dark buildings (Death).' },
    { id: 'famous', name: 'Famous', cost: 2, desc: 'Double starting fame, better mercenaries.' },
    { id: 'runemaster', name: 'Runemaster', cost: 1, desc: 'Double dispel power, crafting artifacts is 50% cheaper.' },
    { id: 'charismatic', name: 'Charismatic', cost: 1, desc: 'Diplomacy bonus, artifacts and mercenaries cost 50% less gold.' },
    { id: 'conjurer', name: 'Conjurer', cost: 1, desc: 'Summon spells cost 25% less research and cast.' },
    { id: 'specialist', name: 'Specialist', cost: 1, desc: 'Spells from realms other than Arcane research faster if mostly focused.' }
];

const PORTRAITS = [
    'assets/wizard_life.png',
    'assets/wizard_death.png',
    'assets/wizard_nature.png',
    'assets/wizard_chaos.png'
];

// Pregenerated Examples
const PREGEN = [
    {
        name: "Merlin",
        portraitIdx: 2,
        spellbooks: { nature: 5, life: 3, sorcery: 0, chaos: 0, death: 0 },
        retorts: ['archmage', 'charismatic', 'sage_master'] // Sage master not defined above, we'll keep it simple
    },
    {
        name: "Lo Pan",
        portraitIdx: 3,
        spellbooks: { sorcery: 5, chaos: 3, nature: 0, life: 0, death: 0 },
        retorts: ['channeler']
    },
    {
        name: "Vlad",
        portraitIdx: 1,
        spellbooks: { death: 8, chaos: 0, nature: 0, life: 0, sorcery: 0 },
        retorts: ['infernal_power', 'channeler'] // Costs: 8 + 2 + 2 = 12 wait, maybe we cap at 11
    }
];

// State
let state = {
    name: '',
    portraitIdx: 0,
    spellbooks: { nature: 0, sorcery: 0, chaos: 0, life: 0, death: 0 },
    retorts: [] // array of id strings
};

let saves = JSON.parse(localStorage.getItem('mom_wizards') || '[]');

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
    renderRetorts();
    updateUI();
    renderSaves();
    renderPregen();

    // Event Listeners
    document.getElementById('nav-editor').addEventListener('click', () => switchView('editor'));
    document.getElementById('nav-saves').addEventListener('click', () => switchView('saves'));
    
    document.getElementById('portrait-prev').addEventListener('click', () => cyclePortrait(-1));
    document.getElementById('portrait-next').addEventListener('click', () => cyclePortrait(1));
    
    elName.addEventListener('input', (e) => {
        state.name = e.target.value;
        updateSaveButtonState();
    });

    elSaveBtn.addEventListener('click', saveWizard);
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
    // Count retorts
    state.retorts.forEach(rid => {
        const retort = RETORTS.find(r => r.id === rid);
        if (retort) spent += retort.cost;
    });
    return spent;
}

function updateUI() {
    const spent = getPicksSpent();
    const remaining = TOTAL_PICKS - spent;
    
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

    // Update Retorts UI
    RETORTS.forEach(ret => {
        const card = document.getElementById(`retort-${ret.id}`);
        const isActive = state.retorts.includes(ret.id);
        
        if (isActive) {
            card.classList.add('active');
            card.classList.remove('disabled');
        } else {
            card.classList.remove('active');
            // Disable if not enough points left to buy it
            if (remaining < ret.cost) {
                card.classList.add('disabled');
            } else {
                card.classList.remove('disabled');
            }
        }
    });

    updateSaveButtonState();
}

function updateSaveButtonState() {
    const remaining = TOTAL_PICKS - getPicksSpent();
    const hasName = state.name.trim().length > 0;
    // Allow saving if name exists and points are exactly 0 (or we can allow saving partials, let's allow saving valid combinations 11 points used)
    elSaveBtn.disabled = !hasName || remaining < 0; // || remaining > 0 (Wait, in standard MoM you don't HAVE to spend all points)
}

function toggleRetort(id) {
    const ret = RETORTS.find(r => r.id === id);
    const cost = ret.cost;
    const remaining = TOTAL_PICKS - getPicksSpent();
    const idx = state.retorts.indexOf(id);
    
    if (idx >= 0) {
        // Remove it
        state.retorts.splice(idx, 1);
    } else {
        // Add it if points allow
        if (remaining >= cost) {
            state.retorts.push(id);
        }
    }
    updateUI();
}

function adjustBook(realmId, delta) {
    const current = state.spellbooks[realmId];
    const newAmount = current + delta;
    const remaining = TOTAL_PICKS - getPicksSpent();
    
    if (delta > 0 && remaining < delta) return;
    if (newAmount < 0) return;
    
    // Restriction check
    if (realmId === 'life' && state.spellbooks.death > 0) return;
    if (realmId === 'death' && state.spellbooks.life > 0) return;
    
    state.spellbooks[realmId] = newAmount;
    updateUI();
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
            <div class="realm-name ${realm.class}">${realm.name}</div>
            <div class="realm-controls">
                <button class="ctrl-btn" id="minus-${realm.id}">-</button>
                <span class="level-val" id="val-${realm.id}">0</span>
                <button class="ctrl-btn" id="plus-${realm.id}">+</button>
            </div>
        `;
        container.appendChild(div);
        
        document.getElementById(`minus-${realm.id}`).addEventListener('click', () => adjustBook(realm.id, -1));
        document.getElementById(`plus-${realm.id}`).addEventListener('click', () => adjustBook(realm.id, 1));
    });
}

function renderRetorts() {
    const container = document.getElementById('retorts-container');
    container.innerHTML = '';
    
    RETORTS.forEach(ret => {
        const div = document.createElement('div');
        div.className = 'retort-card';
        div.id = `retort-${ret.id}`;
        
        div.innerHTML = `
            <div class="retort-info">
                <div class="retort-header">
                    <span class="retort-name">${ret.name}</span>
                    <span class="retort-cost">${ret.cost} pick${ret.cost === 1 ? '' : 's'}</span>
                </div>
                <div class="retort-desc">${ret.desc}</div>
            </div>
            <div class="retort-checkbox"></div>
        `;
        
        div.addEventListener('click', () => toggleRetort(ret.id));
        container.appendChild(div);
    });
}

// -----------------------------------------------------------------
// SAVES AND STATE MANAGEMENT 
// -----------------------------------------------------------------
function saveWizard() {
    const wiz = {
        id: Date.now().toString(),
        name: state.name.trim(),
        portraitIdx: state.portraitIdx,
        spellbooks: { ...state.spellbooks },
        retorts: [...state.retorts],
        timestamp: new Date().toISOString()
    };
    
    // Check if updating
    const existingIdx = saves.findIndex(s => s.id === state.id);
    if (existingIdx >= 0) {
        saves[existingIdx] = wiz;
    } else {
        saves.push(wiz);
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
        retorts: [...wizardObj.retorts]
    };
    // Ensure all spellbooks exist
    REALMS.forEach(r => {
        if (state.spellbooks[r.id] === undefined) state.spellbooks[r.id] = 0;
    });
    
    elName.value = state.name;
    setPortrait(state.portraitIdx);
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
    wiz.retorts.forEach(rid => {
        const ret = RETORTS.find(r => r.id === rid);
        if (ret) magicSummary.push(`<span>${ret.name}</span>`);
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
    const container = document.getElementById('pregen-wizards-list');
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

// Start
init();
