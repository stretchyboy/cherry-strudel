// Valid instruments from Strudel
const validInstruments = new Set([
    'brown', 'bytebeat', 'crackle', 'gm_accordion', 'gm_acoustic_bass',
    'gm_acoustic_guitar_nylon', 'gm_acoustic_guitar_steel', 'gm_agogo',
    'gm_alto_sax', 'gm_applause', 'gm_bagpipe', 'gm_bandoneon', 'gm_banjo',
    'gm_baritone_sax', 'gm_bassoon', 'gm_bird_tweet', 'gm_blown_bottle',
    'gm_brass_section', 'gm_breath_noise', 'gm_celesta', 'gm_cello',
    'gm_choir_aahs', 'gm_church_organ', 'gm_clarinet', 'gm_clavinet',
    'gm_contrabass', 'gm_distortion_guitar', 'gm_drawbar_organ', 'gm_dulcimer',
    'gm_electric_bass_finger', 'gm_electric_bass_pick', 'gm_electric_guitar_clean',
    'gm_electric_guitar_jazz', 'gm_electric_guitar_muted', 'gm_english_horn',
    'gm_epiano1', 'gm_epiano2', 'gm_fiddle', 'gm_flute', 'gm_french_horn',
    'gm_fretless_bass', 'gm_fx_atmosphere', 'gm_fx_brightness', 'gm_fx_crystal',
    'gm_fx_echoes', 'gm_fx_goblins', 'gm_fx_rain', 'gm_fx_sci_fi',
    'gm_fx_soundtrack', 'gm_glockenspiel', 'gm_guitar_fret_noise',
    'gm_guitar_harmonics', 'gm_gunshot', 'gm_harmonica', 'gm_harpsichord',
    'gm_helicopter', 'gm_kalimba', 'gm_koto', 'gm_lead_1_square',
    'gm_lead_2_sawtooth', 'gm_lead_3_calliope', 'gm_lead_4_chiff',
    'gm_lead_5_charang', 'gm_lead_6_voice', 'gm_lead_7_fifths',
    'gm_lead_8_bass_lead', 'gm_marimba', 'gm_melodic_tom', 'gm_music_box',
    'gm_muted_trumpet', 'gm_oboe', 'gm_ocarina', 'gm_orchestra_hit',
    'gm_orchestral_harp', 'gm_overdriven_guitar', 'gm_pad_bowed',
    'gm_pad_choir', 'gm_pad_halo', 'gm_pad_metallic', 'gm_pad_new_age',
    'gm_pad_poly', 'gm_pad_sweep', 'gm_pad_warm', 'gm_pan_flute',
    'gm_percussive_organ', 'gm_piano', 'gm_piccolo', 'gm_pizzicato_strings',
    'gm_recorder', 'gm_reed_organ', 'gm_reverse_cymbal', 'gm_rock_organ',
    'gm_seashore', 'gm_shakuhachi', 'gm_shamisen', 'gm_shanai', 'gm_sitar',
    'gm_slap_bass_1', 'gm_slap_bass_2', 'gm_soprano_sax', 'gm_steel_drums',
    'gm_string_ensemble_1', 'gm_string_ensemble_2', 'gm_synth_bass_1',
    'gm_synth_bass_2', 'gm_synth_brass_1', 'gm_synth_brass_2', 'gm_synth_choir',
    'gm_synth_drum', 'gm_synth_strings_1', 'gm_synth_strings_2', 'gm_taiko_drum',
    'gm_telephone', 'gm_tenor_sax', 'gm_timpani', 'gm_tinkle_bell',
    'gm_tremolo_strings', 'gm_trombone', 'gm_trumpet', 'gm_tuba',
    'gm_tubular_bells', 'gm_vibraphone', 'gm_viola', 'gm_violin',
    'gm_voice_oohs', 'gm_whistle', 'gm_woodblock', 'gm_xylophone', 'pink',
    'pulse', 'saw', 'sawtooth', 'sbd', 'sin', 'sine', 'sqr', 'square',
    'supersaw', 'tri', 'triangle', 'user', 'white', 'z_noise', 'z_sawtooth',
    'z_sine', 'z_square', 'z_tan', 'z_triangle', 'zzfx'
]);

// Parse key signature and return Strudel scale name
// E.g. "G" -> "G:major", "Em" -> "E:minor", "D" -> "D:major"
function parseKeyToScaleName(keyStr) {
    // Default to C major
    if (!keyStr || typeof keyStr !== 'string') return 'C:major';

    // Extract tonic from strings like "G", "Gm", "G major", "G minor", "Em"
    const tonicMatch = keyStr.match(/^([A-G][#b]?)/i);
    if (!tonicMatch) return 'C:major';

    let tonic = tonicMatch[1];
    // Capitalize first letter
    tonic = tonic.charAt(0).toUpperCase() + tonic.slice(1).toLowerCase();

    // Check if minor (m, min, minor, or "Em" style)
    const isMinor = /m|min|minor/i.test(keyStr);
    const mode = isMinor ? 'minor' : 'major';

    return `${tonic}:${mode}`;
}

// Get the abcjs pitch value (0-6) for a note letter (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
function getAbcjsPitchForLetter(letter) {
    const pitchMap = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    return pitchMap[letter.toUpperCase()] || 0;
}

// Convert abcjs pitch to Strudel scale degree relative to the key's tonic
// abcjs uses C=0, D=1, E=2, F=3, G=4, A=5, B=6, c=7 (next octave), etc.
// Strudel with .scale() expects degrees relative to the tonic: 0=tonic, 1=second, etc.
function abcjsPitchToScaleDegree(abcjsPitch, tonicAbcjsPitch) {
    if (abcjsPitch === null || abcjsPitch === undefined) return null;
    return abcjsPitch - tonicAbcjsPitch;
}

// Convert an array of rhythmic durations (floats) to small proportional integers.
// Strategy:
// 1. Use the smallest non-zero duration in the bar as the unit (quantum).
// 2. Convert each duration to an integer count of that unit (rounded).
// 3. Reduce the vector by their GCD so numbers stay small and editable.
function rhythmToIntegers(rhythm) {
    const eps = 1e-9;
    if (!Array.isArray(rhythm) || rhythm.length === 0) return [];
    // find smallest non-zero duration
    const nonZero = rhythm.filter(r => (r || 0) > eps);
    if (nonZero.length === 0) return rhythm.map(_ => 1);
    const minDur = Math.min(...nonZero);

    // convert to integer multiples of minDur
    let ints = rhythm.map(r => {
        if (!r || r <= eps) return 0;
        return Math.max(1, Math.round(r / minDur));
    });

    // gcd helper
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    // reduce by gcd (ignore zeros when computing gcd)
    const positive = ints.filter(v => v > 0);
    let g = positive.length ? positive.reduce((a, b) => gcd(a, b)) : 1;
    if (!g || g < 1) g = 1;
    if (g > 1) ints = ints.map(v => Math.floor(v / g));

    // ensure we don't return all-zero (replace zeros with 1)
    ints = ints.map(v => v === 0 ? 1 : v);

    return ints;
}

function abcToStrudel(abcText) {
    try {
        // Parse using abcjs
        if (typeof ABCJS === 'undefined') {
            return "// Error: ABCJS library not loaded";
        }
        ABCJS.renderAbc("paper", abcText);
        console.debug('abcToStrudel: ABCJS rendered to paper', abcText);
        const tune = ABCJS.parseOnly(abcText);
        if (!tune || !tune[0]) return "// Failed to parse ABC notation";
        const tuneData = tune[0];

        console.debug('abcToStrudel: Parsed tune data=', tuneData);

        // instrument (fall back to gm_piano)
        let instrument = 'gm_piano';
        if (tuneData.metaText && tuneData.metaText.I) {
            const instrumentName = String(tuneData.metaText.I[0]).toLowerCase();
            if (validInstruments.has(instrumentName)) instrument = instrumentName;
        }

        // Parse tune number from X: field
        let tuneNum = 1;
        try {
            const xMatch = abcText.match(/X:\s*([0-9]+)/i);
            if (xMatch) {
                tuneNum = Number(xMatch[1]) || 1;
            }
        } catch (e) { /* ignore parse errors */ }

        // Meter + unit length (ABCJS durations are expressed in notional beats based on L:)
        // We scale durations by the L: denominator, and set barTarget accordingly:
        // barTarget = meterNum * lDen * (4 / meterDen)
        // Examples:
        //   M:3/4 L:1/4 -> lDen=4 => scale=4, barTarget = 3*4*(4/4)=12
        //   M:3/4 L:1/8 -> lDen=8 => scale=8, barTarget = 3*8*(4/4)=24
        //   M:4/4 L:1/4 -> lDen=4 => scale=4, barTarget = 4*4*(4/4)=16
        let meterNum = 4, meterDen = 4, lDen = 4;
        let keyStr = 'C'; // default to C major
        try {
            const mMatch = abcText.match(/M:\s*([0-9]+)\/([0-9]+)/i);
            if (mMatch) {
                meterNum = Number(mMatch[1]) || meterNum;
                meterDen = Number(mMatch[2]) || meterDen;
            }
            const lMatch = abcText.match(/L:\s*([0-9]+)\/([0-9]+)/i);
            if (lMatch) {
                lDen = Number(lMatch[2]) || lDen;
            }
            const kMatch = abcText.match(/K:\s*([A-Ga-g][^|\n\r]*)/i);
            if (kMatch) {
                keyStr = kMatch[1].trim();
            }
        } catch (e) { /* ignore parse errors */ }

        // Parse tempo (Q:) if present
        let cpm = null;
        try {
            const qMatch = abcText.match(/Q:\s*([0-9]+)\/([0-9]+)\s*=\s*([0-9]+)/i);
            if (qMatch) {
                const noteNum = Number(qMatch[1]);
                const noteDen = Number(qMatch[2]);
                const bpm = Number(qMatch[3]);
                
                // Calculate how many of these notes fit in one bar
                // notesPerBar = (meterNum/meterDen) / (noteNum/noteDen)
                //             = (meterNum/meterDen) * (noteDen/noteNum)
                const notesPerBar = (meterNum / meterDen) * (noteDen / noteNum);
                cpm = Math.round(bpm / notesPerBar);
                //console.log(`Tempo parsed: Q:${noteNum}/${noteDen}=${bpm} -> ${notesPerBar} notes per bar -> ${cpm} cpm`);
            }
        } catch (e) { /* ignore tempo parse errors */ }

        const scaleName = parseKeyToScaleName(keyStr);
        // Get the tonic note letter and its abcjs pitch value
        const tonicMatch = keyStr.match(/^([A-G])/i);
        const tonicLetter = tonicMatch ? tonicMatch[1].toUpperCase() : 'C';
        const tonicAbcjsPitch = getAbcjsPitchForLetter(tonicLetter);

        //console.log("Key signature parsed:", keyStr, "Strudel scale:", scaleName, "Tonic:", tonicLetter);

        const scaleNote = lDen * meterDen; // Scale factor to convert durations to integers
        const barTarget = 1; // For @ notation, target is just 1 measure worth of beats
        //console.log("barTarget", barTarget, "meterNum", meterNum, "meterDen", meterDen, "lDen", lDen, "scaleNote", scaleNote);

        // Check if ABC contains polyphonic notation (& symbol)
        const isPolyphonic = abcText.includes('&');
        console.debug(`isPolyphonic = ${isPolyphonic}`);

        // For polyphonic music with &, process each voice separately as layers
        const allVoiceBars = []; // Array of voice arrays: [[voice0bars], [voice1bars], ...]
        const voiceBarIndices = new Map(); // Track current bar index for each voice across all lines
        
        // Walk parsed elements and split by bar markers
        for (const line of tuneData.lines || []) {
            if (!line.staff || !line.staff[0]) continue;
            const voices = line.staff[0].voices || [];
            if (voices.length === 0) continue;

            // Process each voice
            const voicesToProcess = isPolyphonic ? voices : [voices[0]];
            
            for (let voiceIdx = 0; voiceIdx < voicesToProcess.length; voiceIdx++) {
                const voice = voicesToProcess[voiceIdx];
                
                // Ensure we have a bars array for this voice
                if (voiceIdx >= allVoiceBars.length) {
                    allVoiceBars.push([{ notes: [], rhythm: [] }]);
                }
                const bars = allVoiceBars[voiceIdx];
                
                // Get or initialize bar index for this voice
                if (!voiceBarIndices.has(voiceIdx)) {
                    voiceBarIndices.set(voiceIdx, 0);
                }
                let currentBarIdx = voiceBarIndices.get(voiceIdx);
                
                // Ensure we have a bar at the current index
                while (currentBarIdx >= bars.length) {
                    bars.push({ notes: [], rhythm: [] });
                }
                
                // If this bar already has content from a previous line, move to the next bar
                // This prevents accumulating multiple lines' worth of notes into one bar
                if (bars[currentBarIdx].notes.length > 0) {
                    currentBarIdx++;
                    while (currentBarIdx >= bars.length) {
                        bars.push({ notes: [], rhythm: [] });
                    }
                }
                
                // Single-voice processing for this voice
                for (const el of voice) {
                // Skip bar markers; they just tell us to move to the next bar
                if (el.el_type === "bar") {
                    // Store bar marker info for section detection
                    if (!bars[currentBarIdx]) {
                        bars[currentBarIdx] = { notes: [], rhythm: [] };
                    }
                    if (el.startEnding || el.endEnding || el.type) {
                        bars[currentBarIdx].barType = el.type;
                        bars[currentBarIdx].startEnding = el.startEnding;
                        bars[currentBarIdx].endEnding = el.endEnding;
                    }
                    // Ensure current bar exists before moving to next
                    while (currentBarIdx >= bars.length) {
                        bars.push({ notes: [], rhythm: [] });
                    }
                    currentBarIdx++;
                    continue;
                }
                
                // Skip grace notes - they're ornamental and shouldn't affect rhythm
                if (el.gracenotes || el.decoration === 'grace') {
                    continue;
                }
                
                // Skip visual elements like stems, beams, etc - not actual notes
                if (el.el_type === "stem" || el.el_type === "beam") {
                    continue;
                }

                // Ensure we have a current bar for this note
                while (currentBarIdx >= bars.length) {
                    bars.push({ notes: [], rhythm: [] });
                }

                // Scale duration to integer for @ notation
                const durRaw = (el.duration !== undefined && el.duration !== null) ? el.duration : 1;
                const dur = Math.round(durRaw * scaleNote);

                if (el.rest) {
                    bars[currentBarIdx].notes.push('~');
                    bars[currentBarIdx].rhythm.push(dur);
                    continue;
                }

                // Extract abcjs pitch and convert to Strudel scale degree
                let abcjsPitch = null;

                if (el.pitches && el.pitches.length > 0) {
                    abcjsPitch = el.pitches[0].pitch;
                } else if (el.pitch !== undefined) {
                    abcjsPitch = el.pitch;
                }

                if (abcjsPitch !== null) {
                    const scaleDegree = abcjsPitchToScaleDegree(abcjsPitch, tonicAbcjsPitch);
                    bars[currentBarIdx].notes.push(String(scaleDegree));
                } else {
                    bars[currentBarIdx].notes.push('~');
                }
                bars[currentBarIdx].rhythm.push(dur);
                }
                
                // At end of each line, if current bar has content, move to next bar
                // This prevents accumulation when the next line starts
                if (bars[currentBarIdx] && bars[currentBarIdx].notes.length > 0) {
                    currentBarIdx++;
                }
                
                // Save bar index for next line
                voiceBarIndices.set(voiceIdx, currentBarIdx);
            }
        }

        // Process each voice's bars (cleanup, padding, merging)
        const fullBarDuration = meterNum * scaleNote / meterDen;
        
        for (let voiceIdx = 0; voiceIdx < allVoiceBars.length; voiceIdx++) {
            const bars = allVoiceBars[voiceIdx];
            
            // If some bars are empty, treat them as a single rest
            for (const b of bars) {
                if (b.notes.length === 0) {
                    b.notes.push('~');
                    b.rhythm.push(1);
                }
            }
        
        // Split oversized bars (abcjs sometimes creates bars with 2x, 3x, or 4x duration for repeats)
        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            const barDuration = bar.rhythm.reduce((sum, d) => sum + d, 0);
            
            // If bar exceeds full duration, split it into multiple bars
            if (barDuration > fullBarDuration) {
                const newBars = [];
                let currentBar = { notes: [], rhythm: [] };
                let currentDuration = 0;
                
                for (let j = 0; j < bar.notes.length; j++) {
                    const note = bar.notes[j];
                    const dur = bar.rhythm[j];
                    
                    // If adding this note would exceed bar duration, start a new bar
                    if (currentDuration + dur > fullBarDuration && currentBar.notes.length > 0) {
                        newBars.push(currentBar);
                        currentBar = { notes: [], rhythm: [] };
                        currentDuration = 0;
                    }
                    
                    currentBar.notes.push(note);
                    currentBar.rhythm.push(dur);
                    currentDuration += dur;
                    
                    // If we've reached exactly full bar duration, start a new bar
                    if (currentDuration === fullBarDuration) {
                        newBars.push(currentBar);
                        currentBar = { notes: [], rhythm: [] };
                        currentDuration = 0;
                    }
                }
                
                // Add any remaining notes
                if (currentBar.notes.length > 0) {
                    newBars.push(currentBar);
                }
                
                // Filter out all-rest bars from the split result (abcjs padding artifacts)
                const filteredBars = newBars.filter(b => {
                    const allRests = b.notes.every(n => n === '~');
                    return !allRests;
                });
                
                // Replace the oversized bar with the filtered split bars
                if (filteredBars.length > 0) {
                    bars.splice(i, 1, ...filteredBars);
                    i += filteredBars.length - 1; // Adjust index for added bars
                } else {
                    // If all bars were rests, keep one rest bar
                    bars[i] = { notes: ['~'], rhythm: [fullBarDuration] };
                }
            }
        }
        
        // Remove leading bars that are entirely rests
        while (bars.length > 0) {
            const firstBar = bars[0];
            const allRests = firstBar.notes.every(note => note === '~');
            if (allRests) {
                console.debug(`abcToStrudel: removing leading bar of all rests`);
                bars.shift();
            } else {
                break;
            }
        }
        
        // Pad the first bar with a leading rest if it's incomplete (pickup measure)
        // Skip if bar already has full duration (abcjs may have added padding)
        if (bars.length > 0) {
            const firstBar = bars[0];
            const currentDuration = firstBar.rhythm.reduce((sum, d) => sum + d, 0);
            if (currentDuration < fullBarDuration) {
                const restDuration = fullBarDuration - currentDuration;
                firstBar.notes.unshift('~');
                firstBar.rhythm.unshift(restDuration);
            }
        }

        // Only merge partial bars for single-voice music (not polyphonic)
        if (!isPolyphonic) {
            // Merge consecutive partial bars that together make a full bar (for section boundaries)
            // Skip the first bar (already padded as pickup) and work through the rest
            let i = 1;
            while (i < bars.length) {
                const bar = bars[i];
                const barDuration = bar.rhythm.reduce((sum, d) => sum + d, 0);
                
                // If this bar is incomplete and not the last bar
                if (barDuration < fullBarDuration && i < bars.length - 1) {
                    const nextBar = bars[i + 1];
                    const nextDuration = nextBar.rhythm.reduce((sum, d) => sum + d, 0);
                    
                    // If current + next equals a full bar, merge them
                    if (barDuration + nextDuration === fullBarDuration) {
                        bar.notes.push(...nextBar.notes);
                        bar.rhythm.push(...nextBar.rhythm);
                        bars.splice(i + 1, 1);
                        console.debug(`abcToStrudel: merged bars ${i} and ${i+1} (${barDuration} + ${nextDuration} = ${fullBarDuration})`);
                        // Don't increment i, check if we can merge more
                        continue;
                    }
                }
                i++;
            }
        }

        // Pad the last bar with a trailing rest if incomplete (for proper looping)
        // Work backwards to handle the last sounding bar, not empty trailing bars
        for (let i = bars.length - 1; i >= 0; i--) {
            const bar = bars[i];
            const currentDuration = bar.rhythm.reduce((sum, d) => sum + d, 0);
            
            // Skip bars that are already complete or over-full
            if (currentDuration >= fullBarDuration) {
                continue;
            }
            
            // Check if this is essentially an empty bar (only has a tiny rest we added)
            const isEmptyBar = bar.notes.length === 1 && bar.notes[0] === '~' && bar.rhythm[0] <= 1;
            
            if (isEmptyBar && i > 0) {
                // Remove this empty bar and pad the previous bar instead
                bars.splice(i, 1);
                const prevBar = bars[i - 1];
                const prevDuration = prevBar.rhythm.reduce((sum, d) => sum + d, 0);
                if (prevDuration < fullBarDuration) {
                    const restDuration = fullBarDuration - prevDuration;
                    prevBar.notes.push('~');
                    prevBar.rhythm.push(restDuration);
                    console.debug(`abcToStrudel: removed empty bar ${i}, added rest @${restDuration} to bar ${i-1}`);
                }
                break; // Only fix the last incomplete bar
            } else if (!isEmptyBar) {
                // This is a real bar with notes - pad it only if it's the last bar
                const restDuration = fullBarDuration - currentDuration;
                bar.notes.push('~');
                bar.rhythm.push(restDuration);
                console.debug(`abcToStrudel: added rest @${restDuration} to pad last bar (${currentDuration} -> ${fullBarDuration})`);
                break; // Only fix the last incomplete bar
            }
        }
        
            // Debug: print parsed bars (notes, raw durations, raw tokens)
            try {
                for (let i = 0; i < bars.length; i++) {
                    const b = bars[i];
                    // avoid overly verbose output but show key arrays
                    console.debug(`abcToStrudel: voice ${voiceIdx} bar[${i}] notes=`, b.notes, ' rhythm=', b.rhythm);
                }
            } catch (e) {
                // ignore debug failures in older consoles
            }
        }

        // For polyphonic music, ensure all voices have the same number of bars
        if (isPolyphonic && allVoiceBars.length > 1) {
            const maxBars = Math.max(...allVoiceBars.map(v => v.length));
            for (const bars of allVoiceBars) {
                while (bars.length < maxBars) {
                    bars.push({ notes: ['~'], rhythm: [fullBarDuration] });
                }
            }
        }

        // Now generate code for each voice
        let code = ``;
        
        // Add title as a comment if available
        if (tuneData.metaText && tuneData.metaText.title) {
            code += `// ${tuneData.metaText.title}\n`;
        }
        
        if (cpm !== null) {
            code += `setcpm(${cpm})\n`;
        } else {
            code += `setcpm(45)\n`;
        }

        const voicePatterns = [];
        
        for (let voiceIdx = 0; voiceIdx < allVoiceBars.length; voiceIdx++) {
            const bars = allVoiceBars[voiceIdx];
            
            // Deduplicate identical bars and assign names
            const barMap = new Map();
            const uniqueBars = [];
            function keyForBar(b) {
                return b.notes.join(',') + '|' + b.rhythm.join(',');
            }

            for (const b of bars) {
                const k = keyForBar(b);
                if (!barMap.has(k)) {
                    const id = `bar${uniqueBars.length}`;
                    const entry = { id, notes: b.notes, rhythm: b.rhythm };
                    barMap.set(k, entry);
                    uniqueBars.push(entry);
                }
            }
            
            const barsName = `t${tuneNum}_v${voiceIdx}`;
            
            // Build bars array with unique bar patterns
            const barDefs = [];
            for (const ub of uniqueBars) {
                // Normalize rhythm values to small integers via GCD reduction
                const normalizedRhythm = rhythmToIntegers(ub.rhythm);
                
                // Build note@duration pairs
                const notesWithDurations = [];
                for (let i = 0; i < ub.notes.length; i++) {
                    const note = ub.notes[i];
                    const duration = normalizedRhythm[i];
                    notesWithDurations.push(`${note}@${duration}`);
                }
                const noteStr = notesWithDurations.join(' ');
                barDefs.push(`n("${noteStr}")`);
            }
            
            // Pack barDefs into lines under 80 chars
            code += `const ${barsName} = [`;
            let currentLine = '';
            for (let i = 0; i < barDefs.length; i++) {
                const bar = barDefs[i];
                const sep = i < barDefs.length - 1 ? ', ' : '';
                const testLine = currentLine ? `${currentLine}${bar}${sep}` : bar + sep;
                
                if (testLine.length + `const ${barsName} = [`.length <= 80 && currentLine) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        code += currentLine + '\n  ';
                        currentLine = bar + sep;
                    } else {
                        currentLine = bar + sep;
                    }
                }
            }
            if (currentLine) {
                code += currentLine;
            }
            code += `];\n`;

            // Detect sections based on repeat markers
            let sections = [];
            let currentSection = { name: 'intro', start: 0, bars: [] };
            let sectionCount = 0;
            
            for (let i = 0; i < bars.length; i++) {
                const bar = bars[i];
                
                // Check for repeat start (bar_right_repeat or bar_dbl_repeat)
                if (bar.barType === 'bar_right_repeat' || bar.barType === 'bar_dbl_repeat') {
                    // End current section before the repeat marker
                    currentSection.bars.push(i);
                    currentSection.end = i + 1;
                    sections.push(currentSection);
                    
                    // Start new section after the repeat
                    sectionCount++;
                    const sectionName = sectionCount === 1 ? 'main' : `section${sectionCount}`;
                    currentSection = { name: sectionName, start: i + 1, bars: [] };
                } else if (bar.barType === 'bar_left_repeat') {
                    // Start of a repeat section
                    if (currentSection.bars.length > 0) {
                        currentSection.end = i;
                        sections.push(currentSection);
                        sectionCount++;
                    }
                    currentSection = { name: sectionCount === 0 ? 'intro' : 'main', start: i, bars: [] };
                    currentSection.bars.push(i);
                } else {
                    currentSection.bars.push(i);
                }
            }
            
            // Save final section only if there are bars after the last saved section
            if (currentSection.bars.length > 0) {
                currentSection.end = bars.length;
                // Only add this section if it's actually after the previous section
                const lastSection = sections[sections.length - 1];
                if (!lastSection || currentSection.start >= lastSection.end) {
                    // If we already have intro and main, and this section is shorter than main, call it 'coda'
                    if (sections.length >= 2) {
                        const mainSection = sections.find(s => s.name === 'main');
                        if (mainSection && currentSection.bars.length < mainSection.bars.length) {
                            currentSection.name = 'coda';
                        } else {
                            currentSection.name = 'outro';
                        }
                    }
                    sections.push(currentSection);
                }
            }
            
            // Build sequence of indices referencing bars array
            const allIndices = bars.map(b => {
                const k = keyForBar(b);
                const uk = uniqueBars.findIndex(ub => {
                    const ubKey = ub.notes.join(',') + '|' + ub.rhythm.join(',');
                    return ubKey === k;
                });
                return `${barsName}[${uk}]`;
            });
            
            // Store section info for this voice
            allVoiceBars[voiceIdx].sections = sections;
            allVoiceBars[voiceIdx].allIndices = allIndices;
            allVoiceBars[voiceIdx].barsName = barsName;
        }
        
        // Generate section variables for each voice
        let hasSections = allVoiceBars.every(v => v.sections && v.sections.length > 1);
        
        if (hasSections) {
            // Create intro_v0, main_v0, intro_v1, main_v1, etc. as arrays
            code += '\n';
            for (let voiceIdx = 0; voiceIdx < allVoiceBars.length; voiceIdx++) {
                const voiceData = allVoiceBars[voiceIdx];
                const sections = voiceData.sections;
                const allIndices = voiceData.allIndices;
                
                for (const sec of sections) {
                    const secIndices = sec.bars.map(i => allIndices[i]).join(', ');
                    code += `const ${sec.name}_v${voiceIdx} = [${secIndices}];\n`;
                }
            }
            
            // Build voice patterns using spread operator to flatten arrays
            for (let voiceIdx = 0; voiceIdx < allVoiceBars.length; voiceIdx++) {
                const sections = allVoiceBars[voiceIdx].sections;
                const sectionRefs = sections.map(s => `...${s.name}_v${voiceIdx}`).join(', ');
                voicePatterns.push(`cat(${sectionRefs})`);
            }
        } else {
            // No sections - use simple cat for each voice
            for (let voiceIdx = 0; voiceIdx < allVoiceBars.length; voiceIdx++) {
                const allIndices = allVoiceBars[voiceIdx].allIndices;
                voicePatterns.push(`cat(${allIndices.join(', ')})`);
            }
        }
        
        // Combine voices with stack() if polyphonic, otherwise single pattern
        if (voicePatterns.length > 1) {
            code += `\n$: stack(${voicePatterns.join(', ')})\n  .scale("${scaleName}").s("${instrument}")._pianoroll()\n`;
        } else {
            const catLine = `${voicePatterns[0]}.scale("${scaleName}").s("${instrument}");`;
            if (catLine.length <= 80) {
                code += catLine + '\n';
            } else {
                code += `$: ${voicePatterns[0]}\n  .scale("${scaleName}").s("${instrument}")._pianoroll()\n`;
            }
        }

        console.debug('Generated Strudel code:', code);
        return code;
    } catch (err) {
        console.error('Error in abcToStrudel:', err);
        return `// Error parsing ABC notation: ${err && err.message ? err.message : String(err)}`;
    }
}
// Handle convert button click
document.addEventListener('DOMContentLoaded', function () {
    const convertBtn = document.getElementById('convert');
    const abcTextarea = document.getElementById('abc');

    if (convertBtn) {
        convertBtn.addEventListener('click', function () {
            const abcText = abcTextarea.value;
            const strudelCode = abcToStrudel(abcText);

            // Find the strudel-editor element and update it
            const editor = document.querySelector('strudel-editor');
            if (editor) {
                editor.setAttribute('code', strudelCode);
                // Ensure controls are visible
                if (!editor.hasAttribute('show-controls')) {
                    editor.setAttribute('show-controls', 'true');
                }
                // Trigger re-evaluation if the editor supports it
                if (editor.requestUpdate) {
                    editor.requestUpdate();
                }
            }
        });
    }
});
