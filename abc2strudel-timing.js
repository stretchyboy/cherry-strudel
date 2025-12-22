// ABC to Strudel converter - timing-based approach
// Uses abcjs as source of truth for what will actually be played

/**
 * Convert ABC notation to Strudel code using abcjs timing information
 * @param {string} abcText - ABC notation text
 * @returns {string} Strudel pattern code
 */
function abcToStrudel(abcText) {
    try {
        if (!abcText || !abcText.trim()) {
            return '// Please enter ABC notation';
        }

        // Parse ABC using abcjs
        const abcOptions = { 
            print: true,
            header_only: false,
            hint_measures: true
        };
        const tuneBook = ABCJS.parseOnly(abcText, abcOptions);
        
        if (!tuneBook || tuneBook.length === 0) {
            return '// No valid ABC tune found';
        }

        const tuneData = tuneBook[0];
        
        // Get title and tempo
        const title = tuneData.metaText?.title || 'Untitled';
        let tempo = 120; // default
        if (tuneData.metaText?.tempo) {
            tempo = tuneData.metaText.tempo.bpm || 120;
        }
        
        // Get key and scale
        const key = tuneData.lines?.[0]?.staff?.[0]?.key;
        if (!key) {
            return '// Could not determine key signature';
        }
        
        const root = key.root;
        const acc = key.acc || '';
        const mode = key.mode || 'major';
        const scaleName = `${root}${acc}:${mode}`;
        
        // Get tonic as abcjs pitch (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
        const pitchMap = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
        const tonicAbcjsPitch = pitchMap[root] || 0;
        
        // Get meter for bar duration calculation
        const meter = tuneData.lines?.[0]?.staff?.[0]?.meter;
        if (!meter) {
            return '// Could not determine time signature';
        }
        const meterNum = meter.value[0].num;
        const meterDen = meter.value[0].den;
        
        // Calculate milliseconds per bar
        const beatsPerBar = meterNum * (4 / meterDen);
        const msPerBeat = 60000 / tempo;
        const msPerBar = beatsPerBar * msPerBeat;
        
        // Convert BPM to cycles per minute (each bar is one cycle)
        // BPM is quarter notes per minute, so divide by number of quarter notes per bar
        const cpm = Math.round(tempo / beatsPerBar);
        
        console.log('Meter:', meterNum, '/', meterDen);
        console.log('Tempo:', tempo, 'BPM');
        console.log('Beats per bar:', beatsPerBar);
        console.log('Cycles per minute:', cpm);
        console.log('Ms per bar:', msPerBar);
        
        // Extract timing information from abcjs
        // Render to the visible paper div for reference
        const paperDiv = document.getElementById('paper');
        
        const visualObjs = ABCJS.renderAbc(paperDiv, abcText, { 
            responsive: 'resize',
            add_classes: true
        });
        
        if (!visualObjs || visualObjs.length === 0) {
            return '// Could not render ABC notation';
        }
        
        const visualObj = visualObjs[0];
        
        // Extract timing events for each voice separately
        const voiceTimingEvents = []; // Array of arrays, one per voice
        
        // Walk through the visual object to extract notes with timing per voice
        let elementTypes = new Set();
        for (const line of visualObj.lines || []) {
            for (const staff of line.staff || []) {
                const voices = staff.voices || [];
                
                for (let voiceIdx = 0; voiceIdx < voices.length; voiceIdx++) {
                    const voice = voices[voiceIdx];
                    
                    // Ensure we have an array for this voice
                    if (!voiceTimingEvents[voiceIdx]) {
                        voiceTimingEvents[voiceIdx] = { events: [], currentTime: 0 };
                    }
                    
                    let currentTime = voiceTimingEvents[voiceIdx].currentTime;
                    
                    for (const element of voice || []) {
                        elementTypes.add(element.el_type);
                        
                        // Process note elements - check for rest BEFORE requiring pitches (like old converter)
                        if (element.el_type === 'note') {
                            const duration = element.duration || 0;
                            const durationMs = duration * msPerBeat / (1/4); // convert to milliseconds
                            
                            // Check for rest first (element.rest is set for rest elements)
                            if (element.rest) {
                                voiceTimingEvents[voiceIdx].events.push({
                                    timeMs: currentTime,
                                    pitch: null,
                                    durationMs: durationMs,
                                    pitchObj: null,
                                    isRest: true
                                });
                                currentTime += durationMs;
                            } else if (element.pitches && element.pitches.length > 0) {
                                // Process actual notes with pitches
                                for (const pitch of element.pitches) {
                                    voiceTimingEvents[voiceIdx].events.push({
                                        timeMs: currentTime,
                                        pitch: pitch.pitch,
                                        durationMs: durationMs,
                                        midipitch: pitch.midipitch,
                                        pitchObj: pitch,
                                        isRest: false
                                    });
                                }
                                currentTime += durationMs;
                            }
                            // If neither rest nor pitches, skip this element
                        } else if (element.el_type === 'bar') {
                            // Bar marker - could use for grouping
                        }
                    }
                    
                    // Save current time for this voice to continue in next line
                    voiceTimingEvents[voiceIdx].currentTime = currentTime;
                }
            }
        }
        
        console.log('Element types found:', Array.from(elementTypes));
        console.log('Extracted', voiceTimingEvents.length, 'voices');
        for (let i = 0; i < voiceTimingEvents.length; i++) {
            console.log(`Voice ${i}: ${voiceTimingEvents[i].events.length} events`);
        }
        
        // Process each voice separately
        const allVoiceBars = [];
        
        for (let voiceIdx = 0; voiceIdx < voiceTimingEvents.length; voiceIdx++) {
            const timingEvents = voiceTimingEvents[voiceIdx].events;
            console.log(`\nProcessing voice ${voiceIdx} with ${timingEvents.length} events`);
        
            // Group timing events into bars based on time, splitting notes that cross boundaries
            // Also fill gaps with rests (timing-based strategy)
            const bars = [];
            let currentBar = { notes: [], startTime: 0 };
            let barNumber = 0;
        let expectedTime = 0; // Track where we expect the next note to start
        
        for (const event of timingEvents) {
            const noteStartTime = event.timeMs;
            const noteEndTime = event.timeMs + event.durationMs;
            
            // If there's a gap before this note, add a rest to fill it
            if (noteStartTime > expectedTime + 1) { // +1ms tolerance for rounding
                const gapDuration = noteStartTime - expectedTime;
                console.log(`Gap detected: ${gapDuration}ms between ${expectedTime}ms and ${noteStartTime}ms`);
                
                // Add rest to current bar
                const timeOffsetInBar = expectedTime - (barNumber * msPerBar);
                const restDuration = noteStartTime - expectedTime;
                
                currentBar.notes.push({
                    timeOffset: timeOffsetInBar,
                    pitch: null,
                    durationMs: restDuration,
                    isRest: true
                });
            }
            
            // If note starts in a future bar, close current bars and add empty bars
            while (noteStartTime >= (barNumber + 1) * msPerBar) {
                if (currentBar.notes.length > 0) {
                    bars.push(currentBar);
                } else {
                    // Empty bar - add a full-bar rest
                    bars.push({ 
                        notes: [{
                            timeOffset: 0,
                            pitch: null,
                            durationMs: msPerBar,
                            isRest: true
                        }], 
                        startTime: barNumber * msPerBar 
                    });
                }
                barNumber++;
                currentBar = { notes: [], startTime: barNumber * msPerBar };
            }
            
            const currentBarEnd = (barNumber + 1) * msPerBar;
            
            // Check if note extends past current bar boundary
            if (noteEndTime > currentBarEnd + 1) { // +1ms tolerance for rounding
                // Split the note across bars
                const durationInFirstBar = currentBarEnd - noteStartTime;
                
                // Add first part to current bar
                currentBar.notes.push({
                    timeOffset: noteStartTime - (barNumber * msPerBar),
                    pitch: event.pitch,
                    durationMs: durationInFirstBar,
                    midipitch: event.midipitch,
                    pitchObj: event.pitchObj,
                    isRest: event.isRest || false
                });
                
                // Save current bar and start next
                bars.push(currentBar);
                barNumber++;
                
                // Add second part to next bar (tied note)
                const remainingDuration = event.durationMs - durationInFirstBar;
                currentBar = { 
                    notes: [{
                        timeOffset: 0,
                        pitch: event.pitch,
                        durationMs: remainingDuration,
                        midipitch: event.midipitch,
                        pitchObj: event.pitchObj,
                        isRest: event.isRest || false
                    }], 
                    startTime: barNumber * msPerBar 
                };
            } else {
                // Note fits entirely in current bar
                currentBar.notes.push({
                    timeOffset: noteStartTime - (barNumber * msPerBar),
                    pitch: event.pitch,
                    durationMs: event.durationMs,
                    midipitch: event.midipitch,
                    pitchObj: event.pitchObj,
                    isRest: event.isRest || false
                });
            }
            
            // Update expected time for next note
            expectedTime = noteEndTime;
        }
        
        // Push final bar
        if (currentBar.notes.length > 0) {
            bars.push(currentBar);
        }
        
        // Fill any incomplete bars with rests at the end
        for (const bar of bars) {
            const barDuration = bar.notes.reduce((sum, n) => sum + n.durationMs, 0);
            if (barDuration < msPerBar - 1) { // -1ms tolerance
                const lastNote = bar.notes[bar.notes.length - 1];
                const lastNoteEnd = lastNote.timeOffset + lastNote.durationMs;
                const restDuration = msPerBar - lastNoteEnd;
                if (restDuration > 1) {
                    bar.notes.push({
                        timeOffset: lastNoteEnd,
                        pitch: null,
                        durationMs: restDuration,
                        isRest: true
                    });
                    console.log(`Added ${restDuration}ms rest to complete bar`);
                }
            }
        }
        
        console.log(`Voice ${voiceIdx}: Grouped into ${bars.length} bars`);
        
        // Store bars for this voice
        allVoiceBars.push(bars);
        } // End of voice processing loop
        
        // Now generate Strudel code combining all voices
        let code = `// ${title}\n`;
        code += `setcpm(${cpm})\n\n`;
        
        console.log('Tonic abcjs pitch:', tonicAbcjsPitch, 'for key', root + acc);
        
        // Convert each voice's bars to Strudel patterns
        const voicePatterns = [];
        
        for (let voiceIdx = 0; voiceIdx < allVoiceBars.length; voiceIdx++) {
            const bars = allVoiceBars[voiceIdx];
            const strudelBars = [];
        
            for (let i = 0; i < bars.length; i++) {
                const bar = bars[i];
                const noteStrings = [];
            
                console.log(`Voice ${voiceIdx} Bar ${i}:`, bar.notes.length, 'notes');
            
                let totalDuration = 0;
                
                // Group notes by their start time and duration to detect chords
                const noteGroups = new Map();
                for (const note of bar.notes) {
                    const timeKey = Math.round(note.timeOffset);
                    const durationKey = Math.round(note.durationMs);
                    const groupKey = `${timeKey}_${durationKey}`;
                    
                    if (!noteGroups.has(groupKey)) {
                        noteGroups.set(groupKey, { timeOffset: timeKey, duration: durationKey, notes: [] });
                    }
                    noteGroups.get(groupKey).notes.push(note);
                }
                
                // Process each group (sorted by time then duration)
                const sortedGroups = Array.from(noteGroups.values()).sort((a, b) => {
                    if (a.timeOffset !== b.timeOffset) return a.timeOffset - b.timeOffset;
                    return a.duration - b.duration;
                });
                
                for (const group of sortedGroups) {
                    const notesInGroup = group.notes;
                    
                    // Check if all notes in this group are rests
                    const allRests = notesInGroup.every(n => n.isRest);
                    if (allRests) {
                        const note = notesInGroup[0];
                        const durationUnits = Math.round(note.durationMs / msPerBeat * 4);
                        totalDuration += durationUnits;
                        noteStrings.push(`~@${durationUnits}`);
                        continue;
                    }
                    
                    // Get scale degrees for all notes in this group
                    const scaleDegrees = [];
                    let duration = 0;
                    
                    for (const note of notesInGroup) {
                        if (note.isRest) continue;
                        
                        const abcPitch = note.pitchObj?.pitch;
                        if (abcPitch === undefined) continue;
                        
                        const scaleDegree = abcPitch - tonicAbcjsPitch;
                        scaleDegrees.push(scaleDegree);
                        
                        if (duration === 0) {
                            duration = Math.round(note.durationMs / msPerBeat * 4);
                        }
                    }
                    
                    if (scaleDegrees.length === 0) continue;
                    
                    // If multiple notes with same time AND duration, it's a chord - use square brackets with commas
                    if (scaleDegrees.length > 1) {
                        noteStrings.push(`[${scaleDegrees.join(',')}]@${duration}`);
                        console.log(`  Chord: [${scaleDegrees.join(',')}] @ ${duration} units`);
                    } else {
                        noteStrings.push(`${scaleDegrees[0]}@${duration}`);
                        console.log(`  Note: ${scaleDegrees[0]} @ ${duration} units`);
                    }
                    
                    totalDuration += duration;
                }
            
            console.log(`  Total duration: ${totalDuration} units (expected 16 for 4/4)`);
            
            strudelBars.push(`n("${noteStrings.join(' ')}")`);
        }
        
        console.log(`Voice ${voiceIdx}: Generated ${strudelBars.length} Strudel bars`);
        
        // Format bars with wrapping at 80 chars
        code += `const t1_v${voiceIdx} = [`;
        let currentLine = '';
        for (let i = 0; i < strudelBars.length; i++) {
            const bar = strudelBars[i];
            const sep = (i < strudelBars.length - 1) ? ', ' : '';
            const testLine = currentLine ? currentLine + bar + sep : bar + sep;
            
            if (testLine.length <= 80) {
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
        
        code += `];\n\n`;
        
        // Store pattern reference for this voice
        voicePatterns.push(`cat(...t1_v${voiceIdx})`);
        } // End of voice pattern generation loop
        
        // Combine voices with stack() if multiple voices, otherwise single pattern
        if (voicePatterns.length > 1) {
            code += `stack(${voicePatterns.join(', ')})\n  .scale("${scaleName}").s("gm_piano");`;
        } else {
            code += `${voicePatterns[0]}.scale("${scaleName}").s("gm_piano");`;
        }
        
        console.log('Final code length:', code.length);
        
        return code;
        
    } catch (err) {
        console.error('Error in abcToStrudel:', err);
        return `// Error: ${err.message || String(err)}`;
    }
}

// Wire up the convert button
document.addEventListener('DOMContentLoaded', function() {
    const convertBtn = document.getElementById('convert');
    if (!convertBtn) {
        console.error('Convert button not found');
        return;
    }
    
    convertBtn.addEventListener('click', function() {
        const abcText = document.getElementById('abc').value;
        const strudelCode = abcToStrudel(abcText);
        
        console.log('Generated code to set in editor:', strudelCode.substring(0, 200));
        
        // Set Strudel editor content
        const editor = document.querySelector('strudel-editor');
        console.log('Editor element:', editor);
        
        if (editor) {
            // Use setAttribute which is the standard way for web components
            editor.setAttribute('code', strudelCode);
            
            // Trigger update if method exists
            if (editor.requestUpdate) {
                editor.requestUpdate();
            }
        } else {
            console.error('Strudel editor not found');
        }
    });
});
