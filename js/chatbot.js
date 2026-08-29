import { db } from './db.js';
import { APP_CONFIG } from './config.js';

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_ITEMS = 10;
const greeting = 'Choose an appliance and its problem below. I’ll suggest likely causes, safe checks, and when to call a technician.';
const messages = [];
const GENERAL_APPLIANCES = ['Air Conditioner (AC)', 'Washing Machine', 'Refrigerator', 'Television', 'Water Purifier', 'Microwave Oven', 'Dishwasher', 'Water Heater / Geyser', 'Ceiling Fan', 'Other appliance'];
const COMMON_ISSUES = ['Not turning on', 'Poor performance', 'Making unusual noise', 'Leaking water', 'Not cooling or heating', 'Not draining', 'Not filling with water', 'Not spinning or rotating', 'Bad smell', 'Temperature is incorrect', 'Display or buttons not working', 'Remote or app not working', 'Error code shown', 'Stops during use', 'Using too much electricity', 'Needs cleaning or maintenance', 'Filter needs attention', 'Door or lid issue', 'Sparking, smoke, or burning smell', 'Other — describe below'];
const ISSUE_SETS = [
    { matches: ['air conditioner', ' ac', 'ac)', 'aircon'], issues: ['Not cooling', 'Cooling is weak', 'Temperature keeps changing', 'Indoor unit leaking water', 'Outdoor unit leaking water', 'Ice buildup on indoor unit', 'Indoor unit making noise', 'Outdoor unit making noise', 'Airflow is weak', 'Fan is not running', 'Outdoor unit is not running', 'AC turns on and off repeatedly', 'AC is not turning on', 'Remote or display not working', 'Bad smell from unit', 'Water dripping indoors', 'Using too much electricity', 'Filter needs cleaning', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['washing machine', 'washer'], issues: ['Not draining', 'Not spinning', 'Not filling with water', 'Water leaking', 'Machine is vibrating strongly', 'Making loud noise', 'Not starting', 'Stops during a wash cycle', 'Door or lid will not open', 'Door or lid will not lock', 'Clothes are still very wet', 'Detergent residue on clothes', 'Bad smell from drum', 'Error code shown', 'Drum is not rotating', 'Cycle takes too long', 'Water level is incorrect', 'Display or buttons not working', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['refrigerator', 'fridge', 'freezer'], issues: ['Not cooling', 'Freezer is not freezing', 'Food is freezing in refrigerator section', 'Too much ice buildup', 'Frost buildup in freezer', 'Water leaking', 'Water dispenser not working', 'Ice maker not working', 'Making unusual noise', 'Compressor runs continuously', 'Door is not sealing', 'Condensation inside or outside', 'Interior light not working', 'Temperature is incorrect', 'Bad smell inside', 'Display or buttons not working', 'Error code shown', 'Not turning on', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['television', ' tv', 'tv)'], issues: ['Screen is blank', 'No picture but sound works', 'No sound', 'Not turning on', 'Remote not working', 'Apps or Wi-Fi not working', 'HDMI or input not detected', 'Picture is flickering', 'Lines on screen', 'Picture is distorted', 'Screen is too dim', 'Sound is out of sync', 'Volume will not change', 'TV turns off by itself', 'TV is overheating', 'Display is slow or frozen', 'Error message shown', 'Wall-mount or stand concern', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['water purifier'], issues: ['Water flow is slow', 'No water comes out', 'Water leaking', 'Continuous drain water', 'Bad taste or smell in water', 'Filter replacement reminder', 'Filter needs cleaning', 'Making unusual noise', 'Not turning on', 'Display or buttons not working', 'UV or service indicator light', 'Water is not dispensing', 'Water is dispensing slowly', 'Tank is not filling', 'Tank is overflowing', 'Error code shown', 'Power issue', 'Needs routine maintenance', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['microwave'], issues: ['Not heating', 'Turntable not rotating', 'Door will not close', 'Door will not open', 'Display or buttons not working', 'Interior light not working', 'Making unusual noise', 'Stops during heating', 'Food heats unevenly', 'Clock resets', 'Error code shown', 'Not turning on', 'Control panel is unresponsive', 'Microwave trips power', 'Bad smell from unit', 'Steam is escaping', 'Using too much electricity', 'Needs cleaning', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['dishwasher'], issues: ['Not draining', 'Not filling with water', 'Not cleaning dishes properly', 'Water leaking', 'Making unusual noise', 'Not starting', 'Stops during a cycle', 'Door will not close', 'Door will not latch', 'Dishes have detergent residue', 'Dishes are not drying', 'Bad smell inside', 'Spray arms not moving', 'Filter needs cleaning', 'Error code shown', 'Display or buttons not working', 'Water stays at bottom', 'Cycle takes too long', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['water heater', 'geyser'], issues: ['No hot water', 'Water is not hot enough', 'Water is too hot', 'Water leaking', 'Making unusual noise', 'Not turning on', 'Temperature keeps changing', 'Water flow is slow', 'Tank is not filling', 'Pressure relief valve concern', 'Bad smell from water', 'Rusty or discoloured water', 'Error code shown', 'Display or buttons not working', 'Uses too much electricity', 'Power trips when used', 'Needs routine maintenance', 'Heating takes too long', 'Sparking, smoke, or burning smell', 'Other — describe below'] },
    { matches: ['ceiling fan', 'fan'], issues: ['Fan is not turning on', 'Fan speed is slow', 'Fan speed keeps changing', 'Fan is making noise', 'Fan is wobbling', 'Remote not working', 'Regulator not working', 'Fan stops suddenly', 'Fan blades are loose', 'Fan direction is incorrect', 'Light kit not working', 'Fan is overheating', 'Uses too much electricity', 'Power issue', 'Making clicking noise', 'Making humming noise', 'Needs cleaning', 'Needs routine maintenance', 'Sparking, smoke, or burning smell', 'Other — describe below'] }
];
const HAZARD_PATTERN = /\b(gas\s+(?:smell|leak|line)|smell\s+gas|refrigerant|sparking|smoke|burning\s+smell|electrical\s+panel|live\s+wire|exposed\s+wire)\b/i;
let isWaiting = false;
let supabaseClient;

function createWidget() {
    const root = document.createElement('section');
    root.className = 'appliance-chatbot';
    root.setAttribute('aria-label', 'Appliance care assistant');
    root.innerHTML = `
        <button class="appliance-chatbot__launcher" type="button" aria-label="Open appliance care assistant" aria-expanded="false" aria-controls="appliance-chatbot-panel"><i class="fas fa-robot" aria-hidden="true"></i></button>
        <section class="appliance-chatbot__panel" id="appliance-chatbot-panel" aria-label="Appliance care chat" hidden>
            <header class="appliance-chatbot__header">
                <div class="appliance-chatbot__avatar"><i class="fas fa-robot" aria-hidden="true"></i></div>
                <div class="appliance-chatbot__title"><strong>Appliance Care Assistant</strong><span>Quick checks before you book service</span></div>
                <button class="appliance-chatbot__icon-button" type="button" data-chatbot-action="minimize" aria-label="Minimize chat"><i class="fas fa-minus" aria-hidden="true"></i></button>
                <button class="appliance-chatbot__icon-button" type="button" data-chatbot-action="close" aria-label="Close chat"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </header>
            <div class="appliance-chatbot__messages" aria-live="polite" aria-label="Chat messages"></div>
            <form class="appliance-chatbot__form">
                <div class="appliance-chatbot__fields">
                    <label class="appliance-chatbot__field"><span>Appliance</span><select class="appliance-chatbot__select" data-chatbot-appliance aria-label="Select appliance"><option value="">Select appliance</option></select></label>
                    <label class="appliance-chatbot__field"><span>Problem</span><select class="appliance-chatbot__select" data-chatbot-problem aria-label="Select problem" disabled><option value="">Select an appliance first</option></select></label>
                </div>
                <div class="appliance-chatbot__composer">
                    <textarea class="appliance-chatbot__input" rows="1" maxlength="1200" placeholder="Add any useful detail (optional)" aria-label="Describe the appliance problem"></textarea>
                    <button class="appliance-chatbot__send" type="submit" aria-label="Get troubleshooting suggestions"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
                </div>
            </form>
        </section>`;
    document.body.appendChild(root);
    return root;
}

function addMessage(container, role, content) {
    const bubble = document.createElement('div');
    bubble.className = `appliance-chatbot__message appliance-chatbot__message--${role}`;
    bubble.textContent = content;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function renderTyping(container, isVisible) {
    const current = container.querySelector('.appliance-chatbot__typing');
    if (!isVisible) { current?.remove(); return; }
    if (current) return;
    const typing = document.createElement('div');
    typing.className = 'appliance-chatbot__typing';
    typing.setAttribute('aria-label', 'Assistant is typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

async function applianceContext() {
    try {
        if (db.isAuthenticated()) await db.sync();
    } catch (_) {
        // The assistant can still offer general guidance when a context refresh is unavailable.
    }
    return db.getAppliances().slice(0, 20).map(appliance => ({
        brand: appliance.brand || 'Unknown brand',
        model: appliance.model || 'Unknown model',
        category: appliance.type || appliance.name || 'Appliance'
    }));
}

function addOption(select, value, label, selectedValue = '') {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedValue;
    select.appendChild(option);
}

function issuesFor(appliance) {
    const normalised = appliance.toLowerCase();
    const match = ISSUE_SETS.find(set => set.matches.some(keyword => normalised.includes(keyword)));
    return match?.issues || COMMON_ISSUES;
}

function updateProblemOptions(applianceSelect, problemSelect, detailInput) {
    const currentValue = problemSelect.value;
    problemSelect.replaceChildren();
    if (!applianceSelect.value) {
        addOption(problemSelect, '', 'Select an appliance first');
        problemSelect.disabled = true;
        detailInput.placeholder = 'Add any useful detail (optional)';
        return;
    }
    problemSelect.disabled = false;
    addOption(problemSelect, '', 'Choose common problem');
    issuesFor(applianceSelect.value).forEach(issue => addOption(problemSelect, issue, issue, currentValue));
    updateDetailPrompt(problemSelect, detailInput);
}

function updateDetailPrompt(problemSelect, detailInput) {
    const isCustomProblem = problemSelect.value === 'Other — describe below';
    detailInput.placeholder = isCustomProblem ? 'Describe the problem' : 'Add any useful detail (optional)';
    detailInput.required = isCustomProblem;
}

async function refreshApplianceOptions(applianceSelect, problemSelect, detailInput) {
    const selectedValue = applianceSelect.value;
    const context = await applianceContext();
    applianceSelect.replaceChildren();
    addOption(applianceSelect, '', 'Select appliance');
    context.forEach(appliance => {
        const label = `${appliance.category} · ${appliance.brand} ${appliance.model}`;
        addOption(applianceSelect, label, `My appliance — ${label}`, selectedValue);
    });
    GENERAL_APPLIANCES.forEach(appliance => addOption(applianceSelect, appliance, appliance, selectedValue));
    updateProblemOptions(applianceSelect, problemSelect, detailInput);
}

async function getAccessToken() {
    if (!window.supabase || !APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) return APP_CONFIG.supabaseAnonKey;
    supabaseClient ||= window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, { auth: { persistSession: true } });
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token || APP_CONFIG.supabaseAnonKey;
}

function emergencyGuide() {
    return 'Stop using the appliance immediately. Do not attempt a DIY repair or handle wiring, gas, refrigerant, sparks, smoke, or an electrical panel. Move to safety if needed and contact a certified technician immediately. If there is smoke, fire risk, or a gas smell, contact local emergency services.';
}

function offlineGuide(appliance, problem) {
    const applianceName = appliance.toLowerCase();
    const issue = problem.toLowerCase();
    if (HAZARD_PATTERN.test(problem)) return emergencyGuide();
    if (issue.includes('not cooling') || issue.includes('cooling is weak')) {
        const isAirConditioner = applianceName.includes('air conditioner') || /\bac\b/i.test(applianceName);
        const causes = isAirConditioner
            ? ['Air filter may need cleaning.', 'Temperature or mode setting may be incorrect.', 'The outdoor unit may need professional inspection.']
            : ['Temperature setting may be incorrect.', 'Air vents may be blocked by food or containers.', 'The door seal may not be closing fully.'];
        const checks = isAirConditioner
            ? ['Clean or inspect the accessible air filter.', 'Set Cooling mode and choose a lower temperature.', 'Make sure indoor and outdoor vents are not blocked.']
            : ['Check the temperature setting.', 'Leave space around internal air vents.', 'Check that the door closes fully and the seal is clean.'];
        return `Possible causes:\n- ${causes.join('\n- ')}\n\nBasic checks:\n- ${checks.join('\n- ')}\n\nSuggestion:\nIf cooling does not improve, contact the brand service provider or a certified technician.`;
    }
    if (issue.includes('not draining')) {
        return 'Possible causes:\n- The drain hose may be bent or blocked.\n- The accessible drain filter may need cleaning.\n- A drain pump or internal blockage may need service.\n\nBasic checks:\n- Turn the appliance off before checking the drain hose.\n- Check that the hose is not kinked or crushed.\n- Clean the user-accessible filter according to the manual.\n\nSuggestion:\nIf it still will not drain, contact a certified technician.';
    }
    if (issue.includes('bad taste') || issue.includes('bad smell in water')) {
        return 'Possible causes:\n- The filter may be due for replacement.\n- The storage tank may need routine sanitising.\n- The water supply may need professional inspection.\n\nBasic checks:\n- Check the filter or service indicator.\n- Follow the manufacturer cleaning instructions for accessible parts.\n- Do not use the water if its smell or taste is unusually strong.\n\nSuggestion:\nBook the purifier brand service provider if the issue continues after filter maintenance.';
    }
    if (issue.includes('not spinning')) {
        return 'Possible causes:\n- The wash load may be unbalanced.\n- The appliance may not be draining fully.\n- The door or lid may not be locking correctly.\n\nBasic checks:\n- Turn the appliance off and redistribute the load evenly.\n- Check that the door or lid closes properly.\n- Check the accessible drain filter and hose as described in the manual.\n\nSuggestion:\nIf it still does not spin, contact a certified washing-machine technician.';
    }
    if (issue.includes('leaking')) {
        return 'Possible causes:\n- A hose, seal, or accessible filter cover may not be seated properly.\n- The appliance may be overloaded or not level.\n- An internal part may need service.\n\nBasic checks:\n- Stop using the appliance and dry the surrounding area.\n- Check visible hoses and external connections for loose fittings.\n- Consult the manual before checking any user-accessible filter or tray.\n\nSuggestion:\nIf leaking continues, keep the appliance off and contact a certified technician.';
    }
    return `Possible causes:\n- A setting, filter, door/lid, or external connection may need attention.\n- Normal wear or a blocked accessible part may be affecting performance.\n- The appliance may need routine service.\n\nBasic checks:\n- Turn the appliance off before any inspection.\n- Check the user manual for the selected problem and visible error codes.\n- Clean only user-accessible filters or exterior parts as instructed by the manufacturer.\n\nSuggestion:\nIf the problem continues, contact the brand service provider or a certified technician.`;
}

async function requestAnswer(message, appliance, problem) {
    if (!APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) return offlineGuide(appliance, problem);
    const [token, context] = await Promise.all([getAccessToken(), applianceContext()]);
    try {
        const response = await fetch(`${APP_CONFIG.supabaseUrl}/functions/v1/appliance-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: APP_CONFIG.supabaseAnonKey, Authorization: `Bearer ${token}` },
            body: JSON.stringify({ message, applianceContext: context, conversationHistory: messages.slice(0, -1).slice(-MAX_HISTORY_ITEMS) })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.response) return payload.response;
    } catch (_) {
        // The local guide below keeps common troubleshooting useful before the Edge Function is deployed.
    }
    return `${offlineGuide(appliance, problem)}\n\nNote: This is quick offline guidance. Deploy the appliance-chat Edge Function to enable tailored AI answers.`;
}

function initialise() {
    const root = createWidget();
    const launcher = root.querySelector('.appliance-chatbot__launcher');
    const panel = root.querySelector('.appliance-chatbot__panel');
    const messageList = root.querySelector('.appliance-chatbot__messages');
    const form = root.querySelector('.appliance-chatbot__form');
    const applianceSelect = root.querySelector('[data-chatbot-appliance]');
    const problemSelect = root.querySelector('[data-chatbot-problem]');
    const detailInput = root.querySelector('.appliance-chatbot__input');
    const send = root.querySelector('.appliance-chatbot__send');

    const setOpen = async open => {
        panel.hidden = !open;
        launcher.setAttribute('aria-expanded', String(open));
        if (open) {
            await refreshApplianceOptions(applianceSelect, problemSelect, detailInput);
            applianceSelect.focus();
        }
    };
    const setBusy = busy => {
        applianceSelect.disabled = busy;
        problemSelect.disabled = busy || !applianceSelect.value;
        detailInput.disabled = busy;
        send.disabled = busy;
    };
    launcher.addEventListener('click', () => { void setOpen(panel.hidden); });
    root.querySelectorAll('[data-chatbot-action]').forEach(button => button.addEventListener('click', () => { void setOpen(false); }));
    applianceSelect.addEventListener('change', () => updateProblemOptions(applianceSelect, problemSelect, detailInput));
    problemSelect.addEventListener('change', () => updateDetailPrompt(problemSelect, detailInput));
    addMessage(messageList, 'assistant', greeting);

    detailInput.addEventListener('input', () => {
        detailInput.style.height = 'auto';
        detailInput.style.height = `${Math.min(detailInput.scrollHeight, 80)}px`;
    });
    detailInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const appliance = applianceSelect.value;
        const selectedProblem = problemSelect.value;
        const details = detailInput.value.trim();
        if (isWaiting) return;
        if (!appliance) { addMessage(messageList, 'assistant', 'Please select the appliance first.'); applianceSelect.focus(); return; }
        if (!selectedProblem) { addMessage(messageList, 'assistant', 'Please choose the problem you are seeing.'); problemSelect.focus(); return; }
        if (selectedProblem === 'Other — describe below' && !details) { addMessage(messageList, 'assistant', 'Please describe the problem so I can suggest useful checks.'); detailInput.focus(); return; }
        const problem = selectedProblem === 'Other — describe below' ? details : selectedProblem;
        const message = `Appliance: ${appliance}\nProblem: ${problem}${details && problem !== details ? `\nExtra details: ${details}` : ''}`.slice(0, MAX_MESSAGE_LENGTH);
        isWaiting = true;
        detailInput.value = ''; detailInput.style.height = 'auto'; setBusy(true);
        addMessage(messageList, 'user', `${appliance}\n${problem}${details && problem !== details ? `\n${details}` : ''}`);
        messages.push({ role: 'user', content: message });
        renderTyping(messageList, true);
        try {
            const answer = await requestAnswer(message, appliance, problem);
            messages.push({ role: 'model', content: answer });
            addMessage(messageList, 'assistant', answer);
        } catch (error) {
            addMessage(messageList, 'assistant', error.message || 'The assistant is unavailable right now.');
        } finally {
            renderTyping(messageList, false);
            isWaiting = false; setBusy(false); detailInput.focus();
        }
    });
}

function initialiseForAuthenticatedUser() {
    if (db.isAuthenticated()) { initialise(); return; }
    window.setTimeout(initialiseForAuthenticatedUser, 250);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiseForAuthenticatedUser, { once: true });
else initialiseForAuthenticatedUser();
