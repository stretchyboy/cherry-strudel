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
        // Build list of bar character indices from the raw ABC
        const barIndices = [-1];
        for (let i = 0; i < abcText.length; i++) {
            if (abcText[i] === '|') barIndices.push(i);
        }
        barIndices.push(abcText.length);
        const numBars = Math.max(1, barIndices.length - 1);

        // Parse using abcjs
        ABCJS.renderAbc("paper", abcText);
        console.debug('abcToStrudel: ABCJS rendered to paper',abcText);
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
        
        const scaleName = parseKeyToScaleName(keyStr);
        console.log("Key signature parsed:", keyStr, "Strudel scale:", scaleName);
        
        const scaleNote = lDen*meterDen;
        const barTarget = Math.round(meterNum * lDen * (4 / meterDen));
        console.log("barTarget", barTarget, "meterNum", meterNum, "meterDen", meterDen, "lDen", lDen, "scaleNote", scaleNote);
        // Prepare empty bars (preserve order)
        const bars = [];
        for (let i = 0; i < numBars; i++) bars.push({ notes: [], rhythm: [] });

        // Walk parsed elements and place each note/rest into the bar determined by its startChar
        for (const line of tuneData.lines || []) {
            if (!line.staff || !line.staff[0]) continue;
            for (const voice of line.staff[0].voices || []) {
                for (const el of voice) {
                    console.log("abcToStrudel: processing element=", el);
                    // Skip bar markers; we only care about notes and rests
                    if (el.el_type === "bar") continue;
                    
                    // Determine bar index by el.startChar (fallback to first bar)
                    let barIdx = 0;
                    if (typeof el.startChar === 'number' && el.startChar >= 0) {
                        for (let i = 0; i < numBars; i++) {
                            if (el.startChar > barIndices[i] && el.startChar <= barIndices[i + 1]) {
                                barIdx = i;
                                break;
                            }
                        }
                    }

                    // Rhythm: scale duration to integer units (scaleNote = L denominator)
                    const durRaw = (el.duration !== undefined && el.duration !== null) ? el.duration : 0;
                    const dur = durRaw * scaleNote;
                    console.log("abcToStrudel: element duration", el.duration, durRaw, "scaled to", dur, "with scaleNote", scaleNote);

                    if (el.rest) {
                        bars[barIdx].notes.push('~');
                        bars[barIdx].rhythm.push(dur);
                        continue;
                    }

                    // Extract MIDI pitch directly
                    let midi = null;
                    
                    if (el.pitches && el.pitches.length > 0) {
                        const p = el.pitches[0];
                        midi = (p && (p.midi !== undefined)) ? p.midi : (p && p.pitch !== undefined ? p.pitch : null);
                    } else if (el.pitch !== undefined) {
                        midi = el.pitch;
                    }

                    if (midi !== null) {
                        bars[barIdx].notes.push(String(midi));
                    } else {
                        bars[barIdx].notes.push('~');
                    }
                    bars[barIdx].rhythm.push(dur);
                }
            }
        }

        // If some bars are empty, treat them as a single rest
        for (const b of bars) {
            if (b.notes.length === 0) {
                b.notes.push('~');
                b.rhythm.push(barTarget);
            }
        }

        /*
        // Merge trailing implicit rests (where the raw token wasn't an explicit 'z')
        // into the previous note's duration so long notes aren't split as note+rest.
        for (const b of bars) {
            if (b.notes.length >= 2) {
                const lastIdx = b.notes.length - 1;
                if (b.notes[lastIdx] === '~') {
                    const raw = (b.raws[lastIdx] || '').trim();
                    // if raw does NOT contain an explicit 'z' rest, treat this '~' as implicit filler
                    if (raw.indexOf('z') === -1) {
                        // merge into previous
                        b.rhythm[lastIdx - 1] = (b.rhythm[lastIdx - 1] || 0) + (b.rhythm[lastIdx] || 0);
                        b.notes.splice(lastIdx, 1);
                        b.rhythm.splice(lastIdx, 1);
                        b.raws.splice(lastIdx, 1);
                    }
                }
            }
        }
            */

        // Pad only the first bar if it is shorter than the target (pickup measure)
        for (let idx = 0; idx < bars.length; idx++) {
            const b = bars[idx];
            const barSum = (b.rhythm || []).reduce((s, v) => s + (v || 0), 0);
            const deficit = barTarget - barSum;
            if (idx === 0 && deficit > 0) {
                b.notes.unshift('~');
                b.rhythm.unshift(deficit);
                b.raws.unshift('');
                console.debug(`abcToStrudel: padded pickup bar with leading rest of duration ${deficit}`, b);
            }
        }

        // Do not normalize bars further; scaling is deterministic. Only the pickup pad affects bar0.

        // Remove first bar if it's just a full bar rest
        if (bars.length > 0 && bars[0].notes.length === 1 && bars[0].notes[0] === '~') {
            const firstBarDuration = bars[0].rhythm[0] || 0;
            if (Math.abs(firstBarDuration - barTarget) < 0.5) {
                console.debug(`abcToStrudel: removing first bar (full bar rest)`);
                bars.shift();
            }
        }

        // Debug: print parsed bars (notes, raw durations, raw tokens)
        try {
            for (let i = 0; i < bars.length; i++) {
                const b = bars[i];
                // avoid overly verbose output but show key arrays
                console.debug(`abcToStrudel: bar[${i}] notes=`, b.notes, ' rhythm=', b.rhythm, ' raws=', b.raws);
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

        // Generate Strudel code
        // Use .n() for MIDI numbers and .scale() to apply the named scale
        let code = `setcpm(45)\n\n`;
        
        for (const ub of uniqueBars) {
            const noteStr = ub.notes.join(' ');
            const ints = ub.rhythm; // already integer-scaled
            const rhythmStr = ints.join(' ');
            console.debug(`abcToStrudel: bar def ${ub.id} ints=`, ints, ' rawRhythm=', ub.rhythm);
            code += `const ${ub.id} = n("${noteStr}").struct("${rhythmStr}");\n`;
        }

        // Build sequence referencing unique bar ids in order (deduped by name)
        const seq = bars.map(b => barMap.get(keyForBar(b)).id).join(', ');
        code += `\ncat(${seq}).scale("${scaleName}").s("${instrument}");\n`;

        return code;
    } catch (err) {
        console.error('Error in abcToStrudel:', err);
        return `// Error parsing ABC notation: ${err && err.message ? err.message : String(err)}`;
    }
}
// Handle convert button click
        document.addEventListener('DOMContentLoaded', function() {
            const convertBtn = document.getElementById('convert');
            const abcTextarea = document.getElementById('abc');
            
            if (convertBtn) {
                convertBtn.addEventListener('click', function() {
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
