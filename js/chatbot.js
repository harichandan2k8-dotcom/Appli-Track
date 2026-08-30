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

function formatGuide(causes, checks, suggestion) {
    return `Possible causes:\n- ${causes.join('\n- ')}\n\nBasic checks:\n- ${checks.join('\n- ')}\n\nSuggestion:\n${suggestion}`;
}

function applianceKind(appliance) {
    const value = appliance.toLowerCase();
    if (value.includes('air conditioner') || /\bac\b/.test(value)) return 'ac';
    if (value.includes('washing machine') || value.includes('washer')) return 'washer';
    if (value.includes('refrigerator') || value.includes('fridge') || value.includes('freezer')) return 'fridge';
    if (value.includes('television') || /\btv\b/.test(value)) return 'tv';
    if (value.includes('water purifier')) return 'purifier';
    if (value.includes('microwave')) return 'microwave';
    if (value.includes('dishwasher')) return 'dishwasher';
    if (value.includes('water heater') || value.includes('geyser')) return 'heater';
    if (value.includes('fan')) return 'fan';
    return 'general';
}

function offlineGuide(appliance, problem) {
    if (HAZARD_PATTERN.test(problem)) return emergencyGuide();
    const issue = problem.toLowerCase();
    const has = (...terms) => terms.some(term => issue.includes(term));
    const kind = applianceKind(appliance);

    if (kind === 'ac') {
        if (has('not cooling', 'cooling is weak', 'temperature keeps changing')) return formatGuide(
            ['The air filter may be restricting airflow.', 'Cooling mode, temperature, or fan settings may be incorrect.', 'The outdoor unit may need a professional inspection.'],
            ['Clean the accessible air filter and allow it to dry fully.', 'Set the unit to Cooling mode and a lower temperature.', 'Keep indoor and outdoor air openings clear of obstructions.'],
            'If the room is still not cooling after these checks, book an AC technician.'
        );
        if (has('leaking', 'water dripping', 'ice buildup')) return formatGuide(
            ['A blocked condensate drain may be causing water to back up.', 'A dirty filter can contribute to icing and water leakage.', 'An internal drainage or refrigerant-related issue may need service.'],
            ['Turn the AC off if water is reaching electrical areas.', 'Check that the accessible filter is clean.', 'Keep the drain outlet area outside free from visible blockage.'],
            'Do not open the unit or handle refrigerant lines; arrange professional AC service if leakage or ice returns.'
        );
        if (has('noise', 'fan is not running', 'outdoor unit is not running', 'turns on and off')) return formatGuide(
            ['A loose cover, dirty fan area, or unstable mounting may cause noise.', 'Airflow restriction can make the unit cycle repeatedly.', 'The fan or outdoor unit may need a technician inspection.'],
            ['Switch the unit off and check for loose external objects near it.', 'Clean the accessible filter.', 'Ensure furniture or curtains are not blocking the indoor air intake.'],
            'If the fan or outdoor unit does not run normally, book a certified AC technician.'
        );
        if (has('bad smell', 'filter needs cleaning')) return formatGuide(
            ['A damp or dirty filter may be holding dust or odour.', 'Moisture in the indoor unit may need professional cleaning.', 'A drain issue can contribute to persistent odour.'],
            ['Clean the removable filter as described in the manual.', 'Run Fan mode briefly after cooling, if your manual permits it.', 'Keep the room ventilated.'],
            'If the odour persists after filter cleaning, request an AC cleaning/service visit.'
        );
        if (has('remote', 'display', 'not turning on')) return formatGuide(
            ['Remote batteries or settings may need attention.', 'The AC power supply or display board may need inspection.', 'A safety protection mode may be active.'],
            ['Replace remote batteries and check the display.', 'Confirm the wall switch is on.', 'Wait a few minutes before restarting after a power interruption.'],
            'If the AC still will not start, use the brand service provider rather than opening electrical panels.'
        );
        return formatGuide(['A selected AC setting or airflow path may need attention.', 'The unit may be due for routine cleaning.', 'A component may need professional service.'], ['Clean the accessible filter.', 'Check the selected mode and visible error display.', 'Keep vents unobstructed.'], 'If the issue remains, arrange an AC service visit.');
    }

    if (kind === 'washer') {
        if (has('not draining')) return formatGuide(
            ['The drain hose may be bent or blocked.', 'The user-accessible drain filter may need cleaning.', 'A drain pump or internal blockage may need service.'],
            ['Turn the machine off before checking the drain hose.', 'Make sure the hose is not kinked or crushed.', 'Clean the accessible filter only as described in the manual.'],
            'If it still will not drain, contact a certified washing-machine technician.'
        );
        if (has('not spinning', 'drum is not rotating', 'vibrating', 'loud noise')) return formatGuide(
            ['The load may be uneven or too heavy.', 'The machine may not be fully draining before spin.', 'A door-lock, belt, or motor component may need service.'],
            ['Turn the machine off and redistribute the load evenly.', 'Place the machine on a firm, level surface.', 'Check the drain filter and hose using the manual.'],
            'If it still cannot spin or vibrates heavily when empty, book a technician.'
        );
        if (has('not filling', 'water level')) return formatGuide(
            ['The water tap may not be fully open.', 'The inlet hose or accessible inlet screen may be restricted.', 'The water-level system may need service.'],
            ['Check that the water tap is fully open.', 'Ensure the visible inlet hose is not bent.', 'Restart the cycle after confirming normal water supply.'],
            'If water still does not enter correctly, contact the brand service provider.'
        );
        if (has('leaking')) return formatGuide(
            ['The inlet or drain hose may be loose.', 'The detergent amount may be producing excess foam.', 'A door seal or internal part may need service.'],
            ['Stop the cycle and dry the floor.', 'Check visible hose connections for looseness.', 'Use only the detergent amount recommended by the manufacturer.'],
            'Keep the machine off and arrange service if the leak continues.'
        );
        if (has('door', 'lid')) return formatGuide(
            ['Laundry may be preventing the door or lid from closing.', 'The latch area may be dirty.', 'The lock mechanism may need service.'],
            ['Turn the machine off and remove any item caught in the seal.', 'Check that the door closes without force.', 'Do not pull the door open while a cycle is active.'],
            'If the door remains locked after the manual’s wait time, contact a technician.'
        );
        if (has('bad smell', 'detergent residue')) return formatGuide(
            ['Detergent or fabric-softener buildup may be present.', 'Frequent cold washes can leave moisture in the drum.', 'The drain filter may need routine cleaning.'],
            ['Run the manufacturer-recommended cleaning cycle.', 'Leave the door and detergent drawer open after a wash.', 'Use the correct detergent quantity.'],
            'If residue or odour keeps returning, arrange a maintenance visit.'
        );
        return formatGuide(['The selected cycle or load may need adjustment.', 'A filter, hose, or latch may need attention.', 'An error code can indicate a part that needs service.'], ['Note any displayed error code.', 'Use the troubleshooting steps in the machine manual.', 'Restart only after the machine has stopped safely.'], 'If the problem repeats, contact a washing-machine technician.');
    }

    if (kind === 'fridge') {
        if (has('not cooling', 'not freezing', 'freezing in refrigerator', 'temperature')) return formatGuide(
            ['The temperature setting may be incorrect.', 'Air vents may be blocked by food containers.', 'A door seal or cooling component may need inspection.'],
            ['Check the temperature setting in the manual.', 'Leave space around internal vents.', 'Check that the door seal is clean and closes fully.'],
            'If food is not staying at a safe temperature, contact refrigerator service promptly.'
        );
        if (has('ice buildup', 'frost buildup')) return formatGuide(
            ['The door may not be sealing fully.', 'Warm, humid air may be entering often.', 'A defrost component may need professional service.'],
            ['Check the door gasket for crumbs or damage.', 'Avoid holding the door open for long periods.', 'Follow the manual’s defrost guidance only.'],
            'If frost returns quickly, arrange refrigerator service.'
        );
        if (has('leaking', 'condensation')) return formatGuide(
            ['A drain path may be blocked.', 'The door may not be sealing fully.', 'A water-supply connection may need service.'],
            ['Dry the area and check that the appliance is level.', 'Check the door seal and close the door fully.', 'Inspect only visible external water connections.'],
            'If water returns, keep the area dry and contact a technician.'
        );
        if (has('noise', 'compressor runs')) return formatGuide(
            ['The refrigerator may be adjusting temperature after a door opening.', 'The appliance may be uneven and vibrating.', 'A fan or compressor part may need service.'],
            ['Ensure the unit is level and not touching a wall.', 'Make sure containers inside are not rattling.', 'Check that rear ventilation space is clear.'],
            'Persistent loud clicking, grinding, or continuous running needs service.'
        );
        if (has('door', 'interior light', 'display', 'error', 'not turning on')) return formatGuide(
            ['A door switch, display setting, or power connection may need attention.', 'A door seal issue can affect normal operation.', 'An error code may require model-specific service.'],
            ['Note any error code.', 'Check that the plug and outlet appear undamaged.', 'Confirm the door closes without obstruction.'],
            'For repeated errors or a no-power condition, contact the brand service provider.'
        );
        return formatGuide(['Food placement, settings, or a door seal may be affecting operation.', 'A routine clean or defrost may be due.', 'A component may need service.'], ['Check the displayed temperature.', 'Keep internal vents clear.', 'Follow the model manual for cleaning.'], 'If the issue continues, arrange refrigerator service.');
    }

    if (kind === 'tv') {
        if (has('blank', 'no picture', 'lines', 'flickering', 'distorted', 'dim')) return formatGuide(
            ['The selected input source may be incorrect.', 'A cable connection may be loose.', 'The display panel or internal board may need service.'],
            ['Confirm the correct HDMI or input source is selected.', 'Check that external cables are firmly connected.', 'Restart the TV using its normal power controls.'],
            'If the screen remains blank, flickers, or shows lines, contact authorised TV service.'
        );
        if (has('no sound', 'sound is out of sync', 'volume')) return formatGuide(
            ['The TV may be set to an external audio output.', 'The source device may have its own audio setting.', 'A software or speaker issue may need service.'],
            ['Check volume and mute on both TV and source device.', 'Set audio output back to TV speakers for a test.', 'Restart the TV and connected device.'],
            'If sound remains missing on every source, arrange TV service.'
        );
        if (has('remote', 'apps', 'wi-fi', 'hdmi', 'input')) return formatGuide(
            ['Remote batteries, Wi-Fi signal, or the selected source may be the issue.', 'An app may need to be restarted.', 'A cable or connected device may need attention.'],
            ['Replace remote batteries.', 'Restart the TV and your router if apps are affected.', 'Reconnect one external cable at a time.'],
            'If the issue persists across all sources, contact the brand support team.'
        );
        return formatGuide(['A power, software, or connected-device setting may need attention.', 'Ventilation or a loose cable can affect performance.', 'An internal fault may need service.'], ['Restart the TV normally.', 'Check ventilation around the TV.', 'Note any error message before contacting support.'], 'If the problem repeats, use authorised TV service.');
    }

    if (kind === 'purifier') {
        if (has('bad taste', 'bad smell')) return formatGuide(
            ['The filter may be due for replacement.', 'The storage tank may need routine sanitising.', 'The incoming water quality may have changed.'],
            ['Check the filter or service indicator.', 'Follow the manual for user-accessible cleaning only.', 'Do not use water with a strong or unusual smell or taste.'],
            'Book the purifier brand service provider if the issue continues after filter maintenance.'
        );
        if (has('slow', 'no water', 'dispensing', 'not filling')) return formatGuide(
            ['A filter may be clogged.', 'The inlet supply may be low or turned off.', 'The tank or pump may need service.'],
            ['Check that the inlet valve is open.', 'Check the filter-service indicator.', 'Ensure the dispenser tap is fully opened.'],
            'If flow remains low after the recommended filter service, contact the brand technician.'
        );
        if (has('leaking', 'drain water', 'overflow')) return formatGuide(
            ['A visible tube or connection may be loose.', 'The reject-water flow may need normal adjustment by service.', 'An internal valve or tank part may need attention.'],
            ['Turn the purifier off if water is spreading near power points.', 'Check only visible external tubes for kinks or loose fittings.', 'Dry the surrounding area.'],
            'If leaking or overflowing continues, keep it off and book service.'
        );
        return formatGuide(['A filter, inlet supply, or sensor may need attention.', 'Routine service may be due.', 'An error indicator may need model-specific support.'], ['Check the filter-service indicator.', 'Confirm water and power supply are available.', 'Note any error light.'], 'For ongoing issues, contact the purifier service provider.');
    }

    if (kind === 'microwave') {
        if (has('not heating', 'heats unevenly')) return formatGuide(
            ['The selected power level or cooking time may be unsuitable.', 'The door may not be closing fully.', 'A high-voltage internal component may need service.'],
            ['Use microwave-safe cookware and follow the cooking instructions.', 'Check that the door closes cleanly without force.', 'Try a different approved food item at the normal power setting.'],
            'Do not open the microwave casing. If it still does not heat, book authorised service.'
        );
        if (has('turntable', 'door', 'buttons', 'display')) return formatGuide(
            ['The turntable may not be seated correctly.', 'Food or debris may be blocking the door area.', 'A switch or control component may need service.'],
            ['Turn it off and let it cool.', 'Reseat the turntable according to the manual.', 'Clean the door seal area and control panel gently.'],
            'If controls or the door still do not work, use authorised microwave service.'
        );
        return formatGuide(['A selected setting, door switch, or control part may need attention.', 'The appliance may need cleaning.', 'An internal component may need service.'], ['Unplug before exterior cleaning.', 'Check the manual for displayed error codes.', 'Never remove the microwave cover.'], 'If the issue repeats, arrange authorised microwave service.');
    }

    if (kind === 'dishwasher') {
        if (has('not draining', 'water stays')) return formatGuide(['The drain hose may be restricted.', 'The accessible filter may need cleaning.', 'The drain pump may need service.'], ['Turn the dishwasher off before checking.', 'Check the visible drain hose for kinks.', 'Clean the user-accessible filter as described in the manual.'], 'If water remains after a new cycle, contact a dishwasher technician.');
        if (has('not cleaning', 'detergent residue', 'not drying', 'spray arms')) return formatGuide(['Spray arms or filters may be blocked.', 'The selected cycle or detergent amount may be unsuitable.', 'The water temperature or dispenser may need service.'], ['Clean the accessible filter and spray-arm holes according to the manual.', 'Avoid overloading dishes.', 'Use the recommended detergent and cycle.'], 'If results stay poor after cleaning, arrange service.');
        if (has('leaking', 'door', 'latch')) return formatGuide(['The door seal may be dirty or obstructed.', 'The appliance may be overfilled with detergent foam.', 'A hose or internal seal may need service.'], ['Stop the cycle and dry the floor.', 'Check the door seal for food debris.', 'Use only the recommended detergent amount.'], 'If water returns, keep the dishwasher off and book a technician.');
        return formatGuide(['A filter, water supply, or selected cycle may need attention.', 'A sensor or control part may need service.', 'Routine maintenance may be due.'], ['Note error codes.', 'Check the visible water supply valve.', 'Clean user-accessible filters.'], 'If the issue repeats, contact dishwasher service.');
    }

    if (kind === 'heater') {
        if (has('no hot water', 'not hot enough', 'heating takes')) return formatGuide(['The selected temperature may be low.', 'The heater may need time to heat the tank.', 'A heating element or thermostat may need service.'], ['Check the temperature setting from the manual.', 'Allow the normal heating time for your tank size.', 'Check for any visible error indicator.'], 'If water remains cold, book a certified water-heater technician.');
        if (has('too hot', 'temperature keeps')) return formatGuide(['The temperature setting may be too high.', 'The thermostat may need adjustment or service.', 'A mixing valve may need professional inspection.'], ['Lower the user-adjustable temperature setting.', 'Avoid using scalding water.', 'Keep children away from hot-water outlets until resolved.'], 'If water temperature stays unsafe, stop using it and contact a certified technician.');
        if (has('leaking', 'pressure', 'rusty', 'discoloured')) return formatGuide(['A visible connection or pressure-relief component may be involved.', 'Tank corrosion or a valve issue may need service.', 'Water quality can affect tank condition.'], ['Turn the heater off if water is near electrical areas.', 'Check only visible external connections.', 'Do not block or tamper with the pressure-relief valve.'], 'Keep the heater off if leaking continues and call a certified technician.');
        return formatGuide(['A setting, heating component, or safety control may need attention.', 'Routine descaling or service may be due.', 'An error code may need model-specific support.'], ['Note any error code.', 'Check the normal user controls.', 'Do not open electrical covers.'], 'For repeated issues, use certified water-heater service.');
    }

    if (kind === 'fan') {
        if (has('not turning', 'speed is slow', 'speed keeps', 'regulator')) return formatGuide(['The regulator, remote batteries, or selected speed may need attention.', 'Dust buildup can reduce airflow.', 'A capacitor or motor component may need service.'], ['Check the remote batteries or regulator setting.', 'Turn power off before cleaning exterior blades.', 'Make sure no object is obstructing the blades.'], 'If the fan still runs slowly or will not start, contact a qualified technician.');
        if (has('noise', 'wobbling', 'clicking', 'humming')) return formatGuide(['Blade screws or the mounting may be loose.', 'Dust buildup can unbalance the blades.', 'The motor or mounting may need service.'], ['Turn the fan off before inspecting it.', 'Check for visible loose external screws only.', 'Clean dust evenly from all blades.'], 'If wobbling or noise continues, stop using it and arrange qualified service.');
        return formatGuide(['The remote, regulator, mounting, or motor may need attention.', 'Cleaning or routine service may be due.', 'A power issue may need professional inspection.'], ['Check user-accessible controls and remote batteries.', 'Turn power off before cleaning.', 'Note any unusual sound or error indicator.'], 'For repeated issues, use a qualified fan technician.');
    }

    return formatGuide(['The selected appliance setting may need adjustment.', 'A user-accessible filter, hose, door, or exterior part may need attention.', 'A component may need professional service.'], ['Turn the appliance off before inspection.', 'Check the user manual for the selected problem and visible error codes.', 'Clean only user-accessible parts as instructed by the manufacturer.'], 'If the problem continues, contact the brand service provider or a certified technician.');
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
