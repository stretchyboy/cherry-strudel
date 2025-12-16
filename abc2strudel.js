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

        // Prepare empty bars (preserve order) - we'll split by bar elements
        const bars = [{ notes: [], rhythm: [] }];
        let currentBarIdx = 0;

        // Walk parsed elements and split by bar markers
        for (const line of tuneData.lines || []) {
            if (!line.staff || !line.staff[0]) continue;
            // Only process the first voice to avoid duplicates in multi-voice tunes
            const voices = line.staff[0].voices || [];
            if (voices.length === 0) continue;

            for (const el of voices[0]) {
                //console.log("abcToStrudel: processing element=", el);
                // Skip bar markers; they just tell us to move to the next bar
                if (el.el_type === "bar") {
                    currentBarIdx++;
                    if (currentBarIdx >= bars.length) {
                        bars.push({ notes: [], rhythm: [] });
                    }
                    continue;
                }

                // Ensure we have a current bar
                if (currentBarIdx >= bars.length) {
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
        }

        // If some bars are empty, treat them as a single rest
        for (const b of bars) {
            if (b.notes.length === 0) {
                b.notes.push('~');
                b.rhythm.push(1);
            }
        }

        // Remove leading bars that are all rests
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
        
        // Also trim leading rests from the first remaining bar
        if (bars.length > 0) {
            const firstBar = bars[0];
            while (firstBar.notes.length > 0 && firstBar.notes[0] === '~') {
                console.debug(`abcToStrudel: removing leading rest from first bar`);
                firstBar.notes.shift();
                firstBar.rhythm.shift();
            }
        }

        // Remove trailing bars that are all rests
        while (bars.length > 0) {
            const lastBar = bars[bars.length - 1];
            const allRests = lastBar.notes.every(note => note === '~');
            if (allRests) {
                console.debug(`abcToStrudel: removing trailing bar of all rests`);
                bars.pop();
            } else {
                break;
            }
        }

        // Debug: print parsed bars (notes, raw durations, raw tokens)
        try {
            for (let i = 0; i < bars.length; i++) {
                const b = bars[i];
                // avoid overly verbose output but show key arrays
                console.debug(`abcToStrudel: bar[${i}] notes=`, b.notes, ' rhythm=', b.rhythm);
            }
        } catch (e) {
            // ignore debug failures in older consoles
        }

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

        // Generate Strudel code using @ notation for durations
        let code = ``;
        if (cpm !== null) {
            code += `setcpm(${cpm})\n`;
        } else {
            code += `setcpm(45)\n`;
        }
        const barsName = `t${tuneNum}`;
        // Build bars array with unique bar patterns
        const barDefs = [];
        for (const ub of uniqueBars) {
            // Build note@duration pairs
            const notesWithDurations = [];
            for (let i = 0; i < ub.notes.length; i++) {
                const note = ub.notes[i];
                const duration = ub.rhythm[i];
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

        // Build sequence of indices referencing bars array
        const indices = bars.map(b => {
            const k = keyForBar(b);
            const uk = uniqueBars.findIndex(ub => {
                const ubKey = ub.notes.join(',') + '|' + ub.rhythm.join(',');
                return ubKey === k;
            });
            return `${barsName}[${uk}]`;
        }).join(', ');
        
        const catLine = `cat(${indices}).scale("${scaleName}").s("${instrument}");`;
        if (catLine.length <= 80) {
            code += catLine + '\n';
        } else {
            code += `$: cat(${indices})\n  .scale("${scaleName}").s("${instrument}")._pianoroll()\n`;
        }

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
                // Trigger re-evaluation if the editor supports it
                if (editor.requestUpdate) {
                    editor.requestUpdate();
                }
            }
        });
    }
});
