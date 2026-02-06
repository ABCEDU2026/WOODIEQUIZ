/**
 * APP.JS - A80 STABLE v6.0 (FULL UNABRIDGED)
 * - Trạng thái: MASTER FIX
 * - Bảo toàn 100% logic gốc.
 * - Đã sửa lỗi Scope AI & Syntax.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    //  1. CONFIG & GLOBAL VARIABLES
    // ==========================================================================
    let currentUserName = "";
    let allUsersData = {}; 
    const ALL_USERS_DB_KEY = 'quizAppUsers_A80_Stable';
    const LAST_USER_KEY = 'quizAppLastUser_A80';
    const LAST_TOPIC_KEY = 'quizAppLastTopic_A80';

    // DOM Elements
    const appHeaderEl = document.getElementById('app-header');
    const startScreen = document.getElementById('start-screen');
    const quizScreen = document.getElementById('quiz-screen');
    
    const subjectSelector = document.getElementById('subject-selector'); 
    const topicSelector = document.getElementById('topic-selector');
    const topicTotalQuestionsEl = document.getElementById('topic-total-questions');
    
    const questionTextEl = document.getElementById('question-text');
    const optionsContainerEl = document.getElementById('options-container');
    const explanationBoxEl = document.getElementById('explanation-box');
    const explanationTextEl = document.getElementById('explanation-text');
    const readingPassageContainerEl = document.getElementById('reading-passage-container');
    
    const navigationControls = document.getElementById('navigation-controls');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const prevQuestionBtn = document.getElementById('prev-question-btn');
    const stopQuizBtn = document.getElementById('stop-quiz-btn'); 
    
    // AI Elements
    const askAiBtn = document.getElementById('ask-ai-btn');
    const aiResponseArea = document.getElementById('ai-response-area');
    const aiContentText = document.getElementById('ai-content-text');

    // Nút nộp bài chủ động
    let submitQuizBtn = document.getElementById('submit-quiz-btn');
    if (!submitQuizBtn && navigationControls) {
        submitQuizBtn = document.createElement('button');
        submitQuizBtn.id = 'submit-quiz-btn';
        submitQuizBtn.textContent = 'NỘP BÀI';
        submitQuizBtn.className = 'nav-btn primary';
        submitQuizBtn.style.display = 'none'; 
        submitQuizBtn.style.backgroundColor = '#f59e0b';
        submitQuizBtn.style.color = 'white';
        navigationControls.insertBefore(submitQuizBtn, stopQuizBtn);
    }
    
    const dashboardHeaderEl = document.getElementById('dashboard-header');
    const questionCounterEl = document.getElementById('question-counter');
    const questionNavGridEl = document.getElementById('question-nav-grid');
    const resultsModal = document.getElementById('results-modal');
    const victoryModal = document.getElementById('victory-modal');
    const nameInputEl = document.getElementById('name-input');
    const sloganEl = document.getElementById('daily-slogan');

    const sounds = { 
        correct: document.getElementById('sound-correct'), 
        incorrect: document.getElementById('sound-incorrect'), 
        start: document.getElementById('sound-start'), 
        victory: document.getElementById('sound-victory') 
    };

    // Quiz State
    let allTopics = [];                 
    let activeQuestions = [];           
    let currentQuestionIndex = 0;       
    let correctAnswers = 0;             
    let incorrectAnswers = 0;           
    let lifetimeCorrect = 0;            
    let quizTimer;                      
    let autoAdvanceTimeout;             
    let currentMode = '';               
    let isReviewMode = false;           
    let seenQuestionIds = {};           
    const AUTO_ADVANCE_DELAY = 1500;    
    let currentQuizTitle = '';          
    let quizStartTime;

    const LEVELS = [
        { score: 0, name: "Tân binh 🔰" },
        { score: 50, name: "Học trò 🧑‍🎓" },
        { score: 150, name: "Học giả 📚" },
        { score: 300, name: "Thông thái 🧠" },
        { score: 500, name: "Giáo sư 🧑‍🏫" },
        { score: 1000, name: "Hiền triết 🏛️" }
    ];
    
    // Interactive State
    let matchingState = { selectedLeft: null, userMatches: {} };
    let categorizationState = { draggingTag: null };

    // ==========================================================================
    //  2. UTILITIES & PARSER ENGINE
    // ==========================================================================

    function shuffleArray(array) {
        let newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }

    function normalizeString(str) { return str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : ""; }
    function cleanString(str) { return str ? str.toString().toLowerCase().replace(/\s+/g, '').trim() : ""; }

    function normalizeKey(key) {
        const k = key.toString().toLowerCase().trim();
        if (['câu', 'cau', 'question', 'q'].some(x => k.startsWith(x))) return 'question';
        if (['a', 'b', 'c', 'd', 'e', 'f'].includes(k)) return k; 
        if (['loại', 'loai', 'type'].includes(k)) return 'type';
        if (['giải thích', 'giai thich', 'explanation', 'hd', 'lời giải'].includes(k)) return 'explanation';
        if (['đáp án', 'dap an', 'answer', 'kq', 'dap_an', 'dáp_an', 'dáp án'].includes(k)) return 'answer';
        if (['trai', 'left', 'cột trái'].includes(k)) return 'leftCol';
        if (['phai', 'right', 'cột phải'].includes(k)) return 'rightCol';
        if (['muc', 'item'].includes(k)) return 'muc';
        if (['nhom', 'group'].includes(k)) return 'nhom';
        if (['the', 'tag'].includes(k)) return 'the';
        if (['đoạn văn', 'doan van', 'passage', 'text'].includes(k)) return 'doan_van';
        return k; 
    }

    function fixMalformedSVG(htmlString) {
        if (!htmlString || typeof htmlString !== 'string') return "";
        if (!htmlString.includes('<svg')) return htmlString;
        return htmlString.replace(/viewBox=([\d\s\.-]+)/g, 'viewBox="$1"')
            .replace(/points=([\d,\s\.-]+)/g, 'points="$1"')
            .replace(/width=(\d+)/g, 'width="$1"')
            .replace(/height=(\d+)/g, 'height="$1"')
            .replace(/xmlns=([^\s>]+)/g, 'xmlns="$1"')
            .replace(/style=([^"'>]+)/g, 'style="$1"');
    }

    const SLOGAN_LIBRARY = [
        "🚀 Kiến thức là sức mạnh - Level up your brain!",
        "🌱 Mỗi ngày học một chút, tương lai sáng ngời.",
        "🔥 Sai thì sửa, đừng ngại thử thách!",
        "🧠 Nâng cấp bộ não, bão tố cũng qua!"
    ];
    function randomizeSlogan() { if(sloganEl) sloganEl.textContent = `"${SLOGAN_LIBRARY[Math.floor(Math.random() * SLOGAN_LIBRARY.length)]}"`; }

    function calculateLevel(score) {
        let currentLevel = LEVELS[0].name; 
        for (let i = LEVELS.length - 1; i >= 0; i--) { if (score >= LEVELS[i].score) { currentLevel = LEVELS[i].name; break; } }
        return currentLevel;
    }

    function loadAndParseAllTopics() {
        allTopics = [];
        const topicDivs = document.body.querySelectorAll('.topic-data');
        topicDivs.forEach(div => {
            const topicName = div.dataset.topicName || "Chủ đề không tên";
            const subjectName = div.dataset.subjectName || "Chủ đề khác";
            const questionChunk = div.querySelector('.question-data-chunk');
            if (!questionChunk) return;

            const fullDataString = questionChunk.textContent.trim();
            const questionBlocks = fullDataString.split('---').filter(block => block.trim() !== '');
            
            const questions = questionBlocks.map((block, index) => {
                const questionObj = { 
                    id: `${topicName.trim().replace(/\s/g, '_')}-${index}`, 
                    question: '', options: {}, answer: '', explanation: '', userAnswer: null, isAnswered: false, 
                    type: 'mot_dap_an', leftCol: [], rightCol: [], correctDropdowns: [], muc: [], doan_van: '',   
                    nhom: [], the: [], dap_an: {} 
                };
                
                const lines = block.trim().split('\n');
                let currentMultiLineKey = null;

                lines.forEach(line => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return; 
                    const splitIndex = trimmedLine.indexOf('::');
                    
                    if (splitIndex !== -1) {
                        const rawKey = trimmedLine.substring(0, splitIndex);
                        const normalizedKey = normalizeKey(rawKey);
                        const value = trimmedLine.substring(splitIndex + 2).trim();
                        currentMultiLineKey = null;

                        if (['a', 'b', 'c', 'd', 'e', 'f'].includes(normalizedKey)) {
                             questionObj.options[normalizedKey] = value;
                        }
                        else if (normalizedKey === 'type') {
                            let cleanType = cleanString(value);
                            if (cleanType.includes('dien')) cleanType = 'dien_khuyet';
                            else if (cleanType.includes('nhieu')) cleanType = 'nhieu_dap_an';
                            else if (cleanType.includes('dung')) cleanType = 'dung_sai';
                            else if (cleanType.includes('noi')) cleanType = 'noi';
                            else if (cleanType.includes('drop')) cleanType = 'dropdown';
                            else if (cleanType.includes('sap')) cleanType = 'sap_xep';
                            else if (cleanType.includes('phan')) cleanType = 'phan_loai';
                            questionObj.type = cleanType;
                        } 
                        else if (normalizedKey === 'leftCol') questionObj.leftCol.push(value);
                        else if (normalizedKey === 'rightCol') questionObj.rightCol.push(value);
                        else if (normalizedKey === 'muc') questionObj.muc.push(value);
                        else if (normalizedKey === 'nhom') questionObj.nhom.push(value);
                        else if (normalizedKey === 'the') questionObj.the.push(value);
                        else if (normalizedKey === 'answer') {
                            if (questionObj.type === 'phan_loai' || (questionObj.nhom && questionObj.nhom.length > 0)) {
                                const parts = value.split('::');
                                if (parts.length >= 2) {
                                    const rawContent = parts[0].trim();
                                    const groupIdx = parseInt(parts[1].trim(), 10) - 1; 
                                    const matchTag = questionObj.the.find(t => cleanString(t) === cleanString(rawContent));
                                    if (matchTag) questionObj.dap_an[matchTag] = groupIdx; 
                                    else questionObj.dap_an[rawContent] = groupIdx; 
                                }
                            } else if (questionObj.type === 'nhieu_dap_an') {
                                questionObj.answer = value.split(/[,;\s]+/).map(s => s.trim().toLowerCase());
                            } else {
                                questionObj.answer = value;
                            }
                        } 
                        else if (normalizedKey === 'question' || normalizedKey === 'explanation' || normalizedKey === 'doan_van') {
                            questionObj[normalizedKey] = value;
                            currentMultiLineKey = normalizedKey;
                        } 
                    } else if (currentMultiLineKey && trimmedLine) {
                        questionObj[currentMultiLineKey] += '\n' + line; 
                    }
                });
                
                if (!questionObj.type || questionObj.type === 'mot_dap_an') {
                    if (questionObj.leftCol.length > 0) questionObj.type = 'noi';
                    else if (questionObj.nhom.length > 0) questionObj.type = 'phan_loai';
                    else if (questionObj.muc.length > 0) questionObj.type = 'sap_xep';
                    else if (questionObj.question.includes('[[')) questionObj.type = 'dropdown';
                }
                return questionObj;
            }).filter(q => q && (q.question || Object.keys(q.options).length > 0 || q.type === 'noi' || q.type === 'dien_khuyet' || q.type === 'sap_xep'));
            
            if (questions.length > 0) {
                allTopics.push({ name: topicName, subject: subjectName, questions: questions, originalIndex: allTopics.length });
            }
        });
    }

    // ==========================================================================
    //  3. CORE QUIZ LOGIC
    // ==========================================================================

    function startQuiz(mode) {
        if (currentUserName === "") { alert("Vui lòng nhập tên của bạn trước khi bắt đầu!"); nameInputEl.focus(); return; }
        
        localStorage.setItem(LAST_TOPIC_KEY, topicSelector.value); 
        currentMode = mode;
        isReviewMode = false;
        
        if(dashboardHeaderEl) dashboardHeaderEl.textContent = currentUserName;
        appHeaderEl.classList.remove('hidden');
        document.body.classList.add('quiz-active');

        const subjectValue = subjectSelector.value;
        const topicValue = topicSelector.value;
        let questionBank; 

        if (!subjectValue) { alert("Vui lòng chọn một môn học!"); return; }

        if (subjectValue.startsWith('comprehensive_')) {
            const subjectToTest = subjectValue.replace('comprehensive_', '');
            currentQuizTitle = `TỔNG HỢP: ${subjectToTest}`;
            questionBank = allTopics.filter(topic => topic.subject === subjectToTest).reduce((acc, topic) => acc.concat(topic.questions), []);
            questionBank = questionBank.map((q, i) => ({...q, id: `${subjectToTest}-all-${i}`}));
        } else { 
            const selectedIndex = parseInt(topicValue, 10);
            if (isNaN(selectedIndex) || !allTopics[selectedIndex]) { alert("Vui lòng chọn một chủ đề / bài học!"); return; }
            const selectedTopic = allTopics[selectedIndex];
            currentQuizTitle = `${selectedTopic.subject.toUpperCase()} - ${selectedTopic.name}`;
            questionBank = JSON.parse(JSON.stringify(selectedTopic.questions));
        }

        appHeaderEl.textContent = `<<BÀI TRẮC NGHIỆM>> ${currentQuizTitle}`;

        let questionPool;
        if (mode === 'random') {
            const topicNameForSeen = subjectValue.startsWith('comprehensive_') ? subjectValue : (allTopics[topicValue] ? allTopics[topicValue].name : 'unknown_topic');
            const seenIdsForTopic = seenQuestionIds[topicNameForSeen] || [];
            let unseenQuestions = questionBank.filter(q => !seenIdsForTopic.includes(q.id));
            if (unseenQuestions.length < 10) { seenQuestionIds[topicNameForSeen] = []; unseenQuestions = questionBank; }
            questionPool = shuffleArray(unseenQuestions).slice(0, 20);
        } else {
            questionPool = questionBank;
        }

        activeQuestions = questionPool.map(q => prepareQuestionData(q));
        if (activeQuestions.length === 0) { alert("Không có câu hỏi nào để hiển thị."); return; }

        currentQuestionIndex = 0;
        correctAnswers = 0;
        incorrectAnswers = 0;
        
        startScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        updateUserCupDisplay(); 
        
        createQuestionNav();
        startTimer(); 
            if(sounds.start) {
            sounds.start.volume = 0.5;
            sounds.start.play().catch(e => console.log("Chặn tiếng"));
        }
        displayQuestion();
        updateDashboard();

        if(submitQuizBtn) {
            submitQuizBtn.style.display = 'inline-block';
            submitQuizBtn.onclick = function() {
                if(confirm("Bạn có chắc muốn NỘP BÀI và kết thúc ngay không?")) endQuiz();
            };
        }
    }

    function prepareQuestionData(question) {
        const q = JSON.parse(JSON.stringify(question));
        if (q.type === 'mot_dap_an') {
            const keys = Object.keys(q.options);
            const shuffledKeys = shuffleArray([...keys]);
            const originalCorrectContent = q.options[q.answer];
            const shuffledContentMap = {};
            ['a', 'b', 'c', 'd'].forEach((newKey, index) => {
                if (shuffledKeys[index]) {
                    shuffledContentMap[newKey] = q.options[shuffledKeys[index]];
                }
            });
            q.options = shuffledContentMap;
            for (const [key, val] of Object.entries(q.options)) {
                if (val === originalCorrectContent) { q.answer = key; break; }
            }
        }
        if (q.type === 'nhieu_dap_an') {
             const keys = Object.keys(q.options);
             const shuffledKeys = shuffleArray([...keys]); 
             const newOptions = {};
             const fixedKeys = ['a', 'b', 'c', 'd'].slice(0, keys.length);
             const correctContents = q.answer.map(k => q.options[k]);
             const newAnswerKeys = [];
             fixedKeys.forEach((fixedKey, idx) => {
                 const originalKey = shuffledKeys[idx];
                 const content = q.options[originalKey];
                 newOptions[fixedKey] = content;
                 if (correctContents.includes(content)) {
                     newAnswerKeys.push(fixedKey);
                 }
             });
             q.options = newOptions;
             q.answer = newAnswerKeys;
        }
        if (q.type === 'noi') {
            const rightObjects = q.rightCol.map((txt, idx) => ({ text: txt, originalIndex: idx }));
            q.shuffledRightCol = shuffleArray(rightObjects);
        }
        return q;
    }

    function displayQuestion() {
        clearTimeout(autoAdvanceTimeout); 
        updateQuestionNav();
        
        // RESET AI STATE (CRITICAL FIX)
        if(aiResponseArea) aiResponseArea.classList.add('hidden');
        if(aiContentText) aiContentText.innerHTML = '';
        
        matchingState.selectedLeft = null; 
        matchingState.userMatches = {}; 
        
        const question = activeQuestions[currentQuestionIndex];
        if (question.type === 'noi' && question.userAnswer) {
             matchingState.userMatches = {...question.userAnswer};
        }
        
        categorizationState.draggingTag = null;
        const qType = (question.type || 'mot_dap_an').toLowerCase(); 
        questionCounterEl.textContent = `Câu ${currentQuestionIndex + 1} / ${activeQuestions.length}`;
        
        if (qType === 'dropdown') { 
            questionTextEl.style.display = 'none'; 
            questionTextEl.innerHTML = ''; 
        } else { 
            questionTextEl.style.display = 'block'; 
            questionTextEl.innerHTML = fixMalformedSVG(question.question); 
        }

        optionsContainerEl.innerHTML = ''; 
        
        if (readingPassageContainerEl) {
             if (question.doan_van && question.doan_van.trim() !== '') { 
                 const formattedPassage = question.doan_van.trim().split('\n').filter(l => l.trim() !== '').map(l => `<p>${l.trim()}</p>`).join('');
                 readingPassageContainerEl.innerHTML = `<div class="reading-passage-header">📖 ĐỌC HIỂU NGUỒN</div><div class="reading-content">${formattedPassage}</div>`; 
                 readingPassageContainerEl.classList.remove('hidden'); 
             } else { 
                 readingPassageContainerEl.classList.add('hidden'); 
             }
        }
        
        switch (qType) {
            case 'dien_khuyet': renderFillInTheBlank(question); break;
            case 'noi': renderMatching(question); break;
            case 'nhieu_dap_an': renderMultiResponse(question); break;
            case 'dropdown': renderDropdown(question); break;
            case 'sap_xep': renderOrdering(question); break;
            case 'phan_loai': renderCategorization(question); break;
            case 'dung_sai': renderTrueFalse(question); break;
            default: renderMultipleChoice(question); break;
        }

        if (question.isAnswered || isReviewMode) showAnswerState(question);
        else explanationBoxEl.classList.add('hidden');

        updateQuestionNav();
        if (window.MathJax) MathJax.typesetPromise([questionTextEl, optionsContainerEl, explanationBoxEl]);
    }
// ==========================================================================
    //  4. RENDERERS (FULL)
    // ==========================================================================

    function renderMultipleChoice(question) {
        Object.keys(question.options).sort().forEach(key => {
            const button = document.createElement('button'); 
            button.className = 'option'; 
            button.dataset.answer = key; 
            button.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${question.options[key]}`;
            if (question.isAnswered || isReviewMode) button.disabled = true;
            else button.addEventListener('click', () => selectAnswer(key));
            optionsContainerEl.appendChild(button);
        });
    }

    function renderMultiResponse(question) {
        optionsContainerEl.innerHTML = '<p style="font-size: 0.9rem; color: var(--grey-text); margin-bottom: 10px;">(Chọn tất cả các đáp án đúng)</p>';
        const checkBtn = document.createElement('button'); checkBtn.id = 'multi-check-btn'; checkBtn.className = 'nav-btn'; checkBtn.textContent = 'Kiểm tra đáp án';
        Object.keys(question.options).sort().forEach(key => {
            const button = document.createElement('button'); button.className = 'option'; button.dataset.answer = key; button.innerHTML = `<strong>${key.toUpperCase()}.</strong> ${question.options[key]}`;
            if (question.isAnswered || isReviewMode) { button.disabled = true; if (question.userAnswer && question.userAnswer.includes(key)) button.classList.add('selected'); } 
            else { button.addEventListener('click', () => { button.classList.toggle('selected'); checkBtn.disabled = optionsContainerEl.querySelectorAll('.option.selected').length === 0; }); }
            optionsContainerEl.appendChild(button);
        });
        if (!question.isAnswered && !isReviewMode) { checkBtn.disabled = true; checkBtn.addEventListener('click', checkMultiResponseAnswer); optionsContainerEl.appendChild(checkBtn); }
    }

    function renderMatching(question) {
        const leftCol = question.leftCol;
        const displayRightCol = question.shuffledRightCol || question.rightCol.map((t,i)=>({text:t, originalIndex:i}));
        let leftHtml = '', rightHtml = '';
        leftCol.forEach((item, index) => { leftHtml += `<div class="match-item match-left" data-match-id="left-${index}">${item}</div>`; });
        displayRightCol.forEach((item) => { rightHtml += `<div class="match-item match-right" data-match-id="right-${item.originalIndex}">${item.text}</div>`; });
        optionsContainerEl.innerHTML = `
            <div id="matching-container">
                <svg id="matching-svg-canvas"></svg>
                <div id="matching-col-left">${leftHtml}</div>
                <div id="matching-col-right">${rightHtml}</div>
            </div>
            <button id="match-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;
        const checkBtn = document.getElementById('match-check-btn');
        drawMatchingLines(false);
        if (!question.isAnswered && !isReviewMode) {
            checkBtn.disabled = Object.keys(matchingState.userMatches).length === 0;
            document.querySelectorAll('.match-item').forEach(item => { item.addEventListener('click', handleMatchClick); });
            checkBtn.addEventListener('click', checkMatchingAnswer);
        } else {
             checkBtn.style.display = 'none';
             document.querySelectorAll('.match-item').forEach(i => i.style.pointerEvents = 'none');
        }
        window.removeEventListener('resize', handleResizeMatching);
        window.addEventListener('resize', handleResizeMatching);
    }
    
    function handleMatchClick(e) {
        const clickedItem = e.target;
        const id = clickedItem.dataset.matchId;
        if (clickedItem.classList.contains('matched')) {
            let leftKeyToRemove = null;
            if (id.startsWith('left-')) leftKeyToRemove = id;
            else for (const [key, value] of Object.entries(matchingState.userMatches)) if (value === id) { leftKeyToRemove = key; break; }
            if (leftKeyToRemove) {
                delete matchingState.userMatches[leftKeyToRemove];
                updateMatchingClasses();
                drawMatchingLines(false);
                const checkBtn = document.getElementById('match-check-btn');
                if (checkBtn) checkBtn.disabled = Object.keys(matchingState.userMatches).length === 0;
            }
            return;
        }
        if (id.startsWith('left-')) {
            if (matchingState.selectedLeft === clickedItem) { matchingState.selectedLeft.classList.remove('selected'); matchingState.selectedLeft = null; } 
            else { if (matchingState.selectedLeft) matchingState.selectedLeft.classList.remove('selected'); matchingState.selectedLeft = clickedItem; clickedItem.classList.add('selected'); }
        } else if (id.startsWith('right-') && matchingState.selectedLeft) {
            const isRightTaken = Object.values(matchingState.userMatches).includes(id);
            if (isRightTaken) return; 
            const leftId = matchingState.selectedLeft.dataset.matchId;
            matchingState.userMatches[leftId] = id;
            updateMatchingClasses();
            matchingState.selectedLeft.classList.remove('selected');
            matchingState.selectedLeft = null;
            drawMatchingLines(false);
            const checkBtn = document.getElementById('match-check-btn');
            if (checkBtn) checkBtn.disabled = false;
        }
    }
    
    function updateMatchingClasses() {
        document.querySelectorAll('.match-item').forEach(el => el.classList.remove('matched'));
        for (const leftId in matchingState.userMatches) {
            const rightId = matchingState.userMatches[leftId];
            const l = document.querySelector(`[data-match-id="${leftId}"]`);
            const r = document.querySelector(`[data-match-id="${rightId}"]`);
            if(l) l.classList.add('matched');
            if(r) r.classList.add('matched');
        }
    }

    function drawMatchingLines(isReview) {
        const svg = document.getElementById('matching-svg-canvas');
        if (!svg) return; svg.innerHTML = ''; 
        const container = document.getElementById('matching-container'); 
        const containerRect = container.getBoundingClientRect();
        for (const leftId in matchingState.userMatches) {
            const rightId = matchingState.userMatches[leftId];
            drawLine(svg, leftId, rightId, containerRect, isReview);
        }
        if (isReview && activeQuestions[currentQuestionIndex]) {
            activeQuestions[currentQuestionIndex].leftCol.forEach((_, idx) => {
                const correctLeftId = `left-${idx}`;
                const correctRightId = `right-${idx}`;
                if (matchingState.userMatches[correctLeftId] !== correctRightId) drawLine(svg, correctLeftId, correctRightId, containerRect, false, true);
            });
        }
    }

    function drawLine(svg, leftId, rightId, containerRect, isReview, isHint = false) {
        const leftEl = document.querySelector(`[data-match-id="${leftId}"]`);
        const rightEl = document.querySelector(`[data-match-id="${rightId}"]`);
        if (!leftEl || !rightEl) return;
        const leftRect = leftEl.getBoundingClientRect();
        const rightRect = rightEl.getBoundingClientRect();
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', leftRect.right - containerRect.left);
        line.setAttribute('y1', leftRect.top - containerRect.top + leftRect.height / 2);
        line.setAttribute('x2', rightRect.left - containerRect.left);
        line.setAttribute('y2', rightRect.top - containerRect.top + rightRect.height / 2);
        if (isHint) line.classList.add('hint-line');
        else if (isReview) {
            const leftIndex = leftId.split('-')[1];
            const rightIndex = rightId.split('-')[1];
            line.classList.add(leftIndex === rightIndex ? 'correct-line' : 'incorrect-line');
        } else line.classList.add('pending');
        svg.appendChild(line);
    }
    
    function handleResizeMatching() { if(activeQuestions[currentQuestionIndex] && activeQuestions[currentQuestionIndex].type === 'noi') drawMatchingLines(isReviewMode || activeQuestions[currentQuestionIndex].isAnswered); }

    function renderDropdown(question) {
        question.correctDropdowns = []; 
        const processedHTML = question.question.replace(/\[\[(.*?)\]\]/g, (match, content) => {
            const options = content.split('|'); 
            question.correctDropdowns.push(options[0]); 
            const shuffledOptions = shuffleArray(options);
            let selectHTML = `<select class="dropdown-select"><option value="">...</option>`;
            shuffledOptions.forEach(opt => { selectHTML += `<option value="${opt}">${opt}</option>`; });
            return selectHTML + `</select>`;
        });
        optionsContainerEl.innerHTML = `<div class="dropdown-question-text">${processedHTML}</div>`;
        if (!question.isAnswered && !isReviewMode) {
            const checkBtn = document.createElement('button'); 
            checkBtn.id = 'dropdown-check-btn'; checkBtn.className = 'nav-btn'; checkBtn.textContent = 'Kiểm tra đáp án'; 
            checkBtn.disabled = true;
            optionsContainerEl.appendChild(checkBtn);
            const allSelects = optionsContainerEl.querySelectorAll('.dropdown-select');
            allSelects.forEach(select => { select.addEventListener('change', () => { checkBtn.disabled = Array.from(allSelects).every(s => s.value === ""); }); });
            checkBtn.addEventListener('click', checkDropdownAnswer);
        } else if (question.userAnswer) {
            optionsContainerEl.querySelectorAll('.dropdown-select').forEach((select, index) => { select.value = question.userAnswer[index] || ""; select.disabled = true; });
        }
    }

    function renderFillInTheBlank(question) {
        const previousAnswer = (question.userAnswer !== null) ? question.userAnswer : "";
        optionsContainerEl.innerHTML = `<div style="display: flex; gap: 10px;"><input type="text" id="fill-in-input" class="option" placeholder="Nhập câu trả lời..." value="${previousAnswer}" autocomplete="off"><button id="fill-in-submit" class="nav-btn">Kiểm tra</button></div>`;
        const inputEl = document.getElementById('fill-in-input');
        const submitBtn = document.getElementById('fill-in-submit');
        if (!question.isAnswered && !isReviewMode) {
            submitBtn.disabled = true;
            inputEl.addEventListener('input', () => submitBtn.disabled = inputEl.value.trim() === "");
            submitBtn.addEventListener('click', () => selectAnswer(inputEl.value));
            inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !submitBtn.disabled) selectAnswer(inputEl.value); });
            setTimeout(() => inputEl.focus(), 100);
        } else { inputEl.disabled = true; submitBtn.style.display = 'none'; }
    }

    function renderCategorization(question) {
        let groupsHTML = ''; question.nhom.forEach((nhomText, index) => { groupsHTML += `<div class="category-group-box" data-group-index="${index}"><h4>${nhomText}</h4></div>`; });
        let tagsHTML = ''; shuffleArray(question.the).forEach((tagText) => { tagsHTML += `<div class="category-tag" draggable="true" data-tag-text="${tagText}">${tagText}</div>`; });
        optionsContainerEl.innerHTML = `<div class="categorization-container"><div class="category-groups">${groupsHTML}</div><p style="text-align: center; color: var(--grey-text);">🔻 Kéo các thẻ vào nhóm tương ứng 🔻</p><div class="category-tags-pool">${tagsHTML}</div></div><button id="category-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;
        const checkBtn = document.getElementById('category-check-btn');
        if (!question.isAnswered && !isReviewMode) {
            checkBtn.disabled = true;
            setupDragAndDrop(checkBtn);
            checkBtn.addEventListener('click', checkCategorizationAnswer);
        }
        if (isReviewMode && question.userAnswer) {
             checkBtn.style.display = 'none'; 
             const tagsPool = optionsContainerEl.querySelector('.category-tags-pool'); tagsPool.innerHTML = ''; 
             Object.entries(question.userAnswer).forEach(([tagText, groupIndex]) => {
                 const tag = document.createElement('div'); tag.className = 'category-tag'; tag.dataset.tagText = tagText; tag.textContent = tagText;
                 if (groupIndex === -1) tagsPool.appendChild(tag); 
                 else { 
                     const groupZone = optionsContainerEl.querySelector(`.category-group-box[data-group-index="${groupIndex}"]`); 
                     if(groupZone) groupZone.appendChild(tag); 
                 }
             });
        }
    }

    function setupDragAndDrop(checkBtn) {
        const tags = document.querySelectorAll('.category-tag');
        const poolZone = document.querySelector('.category-tags-pool');
        tags.forEach(tag => {
            tag.addEventListener('dragstart', () => { categorizationState.draggingTag = tag; tag.classList.add('dragging'); });
            tag.addEventListener('dragend', () => { tag.classList.remove('dragging'); categorizationState.draggingTag = null; if(poolZone.children.length < tags.length) checkBtn.disabled = false; });
            tag.addEventListener('touchstart', (e) => { categorizationState.draggingTag = tag; tag.classList.add('dragging'); }, {passive: false});
            tag.addEventListener('touchend', (e) => { 
                tag.classList.remove('dragging'); 
                const touch = e.changedTouches[0]; 
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if(elementBelow) { 
                    const dropZone = elementBelow.closest('.category-group-box, .category-tags-pool'); 
                    if (dropZone) { dropZone.appendChild(tag); if(poolZone.children.length < tags.length) checkBtn.disabled = false; } 
                }
            });
            tag.addEventListener('touchmove', (e) => { e.preventDefault(); }, {passive: false});
        });
        document.querySelectorAll('.category-group-box, .category-tags-pool').forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (categorizationState.draggingTag) zone.appendChild(categorizationState.draggingTag); });
        });
    }

    function renderTrueFalse(question) {
        optionsContainerEl.innerHTML = `<div class="tf-button-container"><button class="option tf-btn" data-answer="dung">ĐÚNG</button><button class="option tf-btn" data-answer="sai">SAI</button></div>`;
        if (!question.isAnswered && !isReviewMode) { optionsContainerEl.querySelectorAll('.tf-btn').forEach(btn => btn.addEventListener('click', () => selectAnswer(btn.dataset.answer))); }
    }

    function renderOrdering(question) {
        const itemsToShow = (question.isAnswered || isReviewMode) ? (question.userAnswer || []) : shuffleArray(question.muc);
        let itemsHTML = ''; itemsToShow.forEach((itemText) => { itemsHTML += `<li class="ordering-item" draggable="true" data-text="${itemText}">${itemText}</li>`; });
        optionsContainerEl.innerHTML = `<div style="font-style: italic; color: var(--grey-text); margin-bottom: 10px; text-align: center;">(Kéo thả để sắp xếp)</div><ul id="ordering-list" class="ordering-container">${itemsHTML}</ul><button id="order-check-btn" class="nav-btn">Kiểm tra đáp án</button>`;
        const checkBtn = document.getElementById('order-check-btn');
        if (!question.isAnswered && !isReviewMode) {
            checkBtn.disabled = true;
            setupOrderingDrag(checkBtn);
            checkBtn.addEventListener('click', checkOrderingAnswer);
        } else { checkBtn.style.display = 'none'; }
    }

    function setupOrderingDrag(checkBtn) {
        const list = document.getElementById('ordering-list'); 
        let draggingItem = null;
        list.querySelectorAll('.ordering-item').forEach(item => {
            item.addEventListener('dragstart', () => { draggingItem = item; setTimeout(() => item.classList.add('dragging'), 0); });
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggingItem = null; checkBtn.disabled = false; });
            item.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(list, e.clientY); if (afterElement == null) list.appendChild(draggingItem); else list.insertBefore(draggingItem, afterElement); });
        });
    }
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ordering-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ==========================================================================
    //  5. CHECKING LOGIC
    // ==========================================================================

    function selectAnswer(userSelection) { 
        const question = activeQuestions[currentQuestionIndex];
        if (question.isAnswered) return;
        question.isAnswered = true;
        question.userAnswer = userSelection; 
        let isCorrect = (question.type === 'dien_khuyet') ? normalizeString(userSelection) === normalizeString(question.answer) : (userSelection === question.answer);
        finalizeAnswer(isCorrect, question);
    }

    function checkMultiResponseAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const selected = Array.from(optionsContainerEl.querySelectorAll('.option.selected')).map(b => b.dataset.answer);
        question.isAnswered = true;
        const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(question.answer.sort());
        question.userAnswer = selected;
        finalizeAnswer(isCorrect, question);
    }

    function checkMatchingAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const userMatches = matchingState.userMatches;
        let correctCount = 0;
        for (const [leftId, rightId] of Object.entries(userMatches)) {
            const leftIndex = leftId.split('-')[1];
            const rightIndex = rightId.split('-')[1];
            if (leftIndex === rightIndex) correctCount++;
        }
        const isCorrect = (correctCount === question.leftCol.length) && (Object.keys(userMatches).length === question.leftCol.length);
        question.isAnswered = true;
        question.userAnswer = {...userMatches};
        finalizeAnswer(isCorrect, question);
    }

    function checkDropdownAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const selects = optionsContainerEl.querySelectorAll('.dropdown-select');
        const userAnswers = Array.from(selects).map(s => s.value);
        let isCorrect = true;
        userAnswers.forEach((ans, idx) => { if (ans !== question.correctDropdowns[idx]) isCorrect = false; });
        question.isAnswered = true;
        question.userAnswer = userAnswers;
        selects.forEach((s, idx) => { s.disabled = true; if (s.value === question.correctDropdowns[idx]) s.classList.add('correct'); else s.classList.add('incorrect'); });
        finalizeAnswer(isCorrect, question);
    }

    function checkCategorizationAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const groupBoxes = optionsContainerEl.querySelectorAll('.category-group-box');
        const userMap = {}; 
        let isCorrect = true;
        groupBoxes.forEach(box => {
            const groupIndex = parseInt(box.dataset.groupIndex);
            const tags = box.querySelectorAll('.category-tag');
            tags.forEach(tag => {
                userMap[tag.dataset.tagText] = groupIndex;
                const correctGroupIndex = question.dap_an[tag.dataset.tagText];
                if (groupIndex === correctGroupIndex) tag.classList.add('correct'); else { tag.classList.add('incorrect'); isCorrect = false; }
            });
        });
        if (optionsContainerEl.querySelectorAll('.category-tags-pool .category-tag').length > 0) isCorrect = false;
        question.isAnswered = true;
        question.userAnswer = userMap;
        finalizeAnswer(isCorrect, question);
    }

    function checkOrderingAnswer() {
        const question = activeQuestions[currentQuestionIndex];
        const items = optionsContainerEl.querySelectorAll('.ordering-item');
        const userOrder = Array.from(items).map(i => i.dataset.text);
        const isCorrect = JSON.stringify(userOrder) === JSON.stringify(question.muc);
        items.forEach((item, index) => { item.draggable = false; if (item.dataset.text === question.muc[index]) item.classList.add('correct'); else item.classList.add('incorrect'); });
        question.isAnswered = true;
        question.userAnswer = userOrder;
        finalizeAnswer(isCorrect, question);
    }

    function finalizeAnswer(isCorrect, question) {
        if (isCorrect) { correctAnswers++; if (sounds.correct) sounds.correct.play(); } 
        else { incorrectAnswers++; if (sounds.incorrect) sounds.incorrect.play(); }
        updateQuestionNav(isCorrect);
        setTimeout(() => {
            showAnswerState(question);
            updateDashboard();
            if (currentQuestionIndex < activeQuestions.length - 1 && !['noi', 'nhieu_dap_an', 'sap_xep', 'phan_loai', 'dropdown'].includes(question.type)) {
                autoAdvanceTimeout = setTimeout(handleNextQuestion, AUTO_ADVANCE_DELAY);
            }
        }, 100);
    }

    function showAnswerState(question) {
        explanationBoxEl.classList.remove('hidden');
        const expText = question.explanation ? fixMalformedSVG(question.explanation) : "Không có giải thích chi tiết.";
        explanationTextEl.innerHTML = expText;
        const options = optionsContainerEl.querySelectorAll('.option');
        options.forEach(btn => {
            const key = btn.dataset.answer;
            if (key === question.answer) btn.classList.add('correct');
            if (question.userAnswer === key && key !== question.answer) btn.classList.add('incorrect');
            if (question.userAnswer === key) { btn.style.borderWidth = "3px"; btn.style.borderColor = (key === question.answer) ? "var(--correct-color)" : "var(--incorrect-color)"; }
        });
        if (question.type === 'dung_sai') {
             optionsContainerEl.querySelectorAll('.tf-btn').forEach(btn => {
                 if(btn.dataset.answer === question.answer) btn.classList.add('correct');
                 if(question.userAnswer === btn.dataset.answer && btn.dataset.answer !== question.answer) btn.classList.add('incorrect');
             });
        }
    }

    function handleNextQuestion() { 
        if (currentQuestionIndex < activeQuestions.length - 1) { 
            currentQuestionIndex++; 
            displayQuestion(); 
        } else if (!isReviewMode) {
            const confirmSubmit = confirm("Bạn đã hoàn thành câu hỏi cuối cùng.\n\n- Nhấn OK để NỘP BÀI.\n- Nhấn Cancel để XEM LẠI.");
            if (confirmSubmit) endQuiz();
        }
    }

    function handlePrevQuestion() { 
        if (currentQuestionIndex > 0) { 
            if (activeQuestions[currentQuestionIndex].type === 'noi' && !activeQuestions[currentQuestionIndex].isAnswered) activeQuestions[currentQuestionIndex].userAnswer = matchingState.userMatches;
            currentQuestionIndex--; 
            displayQuestion(); 
        } 
    }

    function endQuiz() {
        clearInterval(quizTimer);
        let timeSpentFormatted = document.getElementById('timer-value').textContent;
        let userData = allUsersData[currentUserName] || { cupCount: 0, lifetimeCorrect: 0, topicResults: [], seenQuestionIds: {} };
        allUsersData[currentUserName] = userData;
        userData.lifetimeCorrect += correctAnswers;
        const acc = Math.round((correctAnswers / activeQuestions.length) * 100) || 0;
        const quizResult = { topic: currentQuizTitle, score: correctAnswers, total: activeQuestions.length, accuracy: acc, date: new Date().toISOString(), timeSpent: timeSpentFormatted };
        userData.topicResults.push(quizResult);
        if (acc >= 90) { userData.cupCount++; showVictoryModal(correctAnswers, acc); } 
        else { 
            document.getElementById('final-score').textContent = correctAnswers;
            document.getElementById('final-accuracy').textContent = `${acc}%`;
            document.getElementById('final-correct').textContent = correctAnswers;
            document.getElementById('final-total').textContent = activeQuestions.length;
            resultsModal.classList.remove('hidden'); 
        }
        if (currentMode === 'random') {
             const tName = subjectSelector.value.startsWith('comprehensive_') ? subjectSelector.value : (allTopics[topicSelector.value] ? allTopics[topicSelector.value].name : 'unknown');
             userData.seenQuestionIds[tName] = [...new Set([...(userData.seenQuestionIds[tName]||[]), ...activeQuestions.map(q=>q.id)])];
        }
        localStorage.setItem(ALL_USERS_DB_KEY, JSON.stringify(allUsersData));
        updateUserCupDisplay(); updateDashboard(); displayUserLog(currentUserName); updateLeaderboardUI();   
    }

    // ==========================================================================
    //  6. REPORTING & OTHERS
    // ==========================================================================

    function handlePrintSummaryReport() {
        if (!currentUserName) return;
        const userData = allUsersData[currentUserName];
        if (!userData || !userData.topicResults || userData.topicResults.length === 0) { alert("Chưa có kết quả."); return; }
        const startDateEl = document.getElementById('report-start-date');
        const endDateEl = document.getElementById('report-end-date');
        let filteredResults = userData.topicResults;
        if (!startDateEl.value && !endDateEl.value) {
            const today = new Date().toDateString();
            filteredResults = userData.topicResults.filter(log => new Date(log.date).toDateString() === today);
        } else {
            const start = startDateEl.value ? new Date(startDateEl.value) : new Date('2000-01-01');
            const end = endDateEl.value ? new Date(endDateEl.value) : new Date();
            end.setHours(23, 59, 59, 999);
            filteredResults = userData.topicResults.filter(log => { const d = new Date(log.date); return d >= start && d <= end; });
        }
        if (filteredResults.length === 0) { alert("Không tìm thấy kết quả."); return; }
        const todayStr = new Date().toLocaleDateString('vi-VN');
        let content = `<html><head><title>Phiếu Thành Tích</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #333;padding:8px;text-align:center}th{background:#eee}</style></head><body><h2>Báo Cáo: ${currentUserName}</h2><p>Ngày: ${todayStr}</p><table><thead><tr><th>Bài</th><th>Điểm</th><th>%</th></tr></thead><tbody>`;
        filteredResults.forEach(log => { content += `<tr><td>${log.topic}</td><td>${log.score}/${log.total}</td><td>${log.accuracy}%</td></tr>`; });
        content += `</tbody></table></body></html>`;
        const printWin = window.open('', '_blank'); printWin.document.write(content); printWin.document.close();
        setTimeout(() => { printWin.print(); printWin.close(); }, 500);
    }

    function populateSubjectSelector() {
        subjectSelector.innerHTML = '<option value="">--- Vui lòng chọn ---</option>';
        if (allTopics.length === 0) return;
        const subjects = {}; 
        allTopics.forEach(t => { if (!subjects[t.subject]) subjects[t.subject] = []; subjects[t.subject].push(t); });
        Object.keys(subjects).sort().forEach(s => {
            const opt = document.createElement('option'); opt.value = s; opt.textContent = s; subjectSelector.appendChild(opt);
        });
        const compGroup = document.createElement('optgroup'); compGroup.label = "TỔNG HỢP";
        Object.keys(subjects).sort().forEach(s => {
             const opt = document.createElement('option'); opt.value = `comprehensive_${s}`; opt.textContent = `Tổng hợp ${s}`; compGroup.appendChild(opt);
        });
        subjectSelector.appendChild(compGroup);
        handleSubjectChange();
    }

    function handleSubjectChange() {
        const val = subjectSelector.value;
        if (!val || val.startsWith('comprehensive_')) { topicSelector.innerHTML = '<option>---</option>'; topicSelector.disabled = true; } 
        else {
            topicSelector.disabled = false; topicSelector.innerHTML = '<option value="">--- Chọn Bài ---</option>';
            allTopics.filter(t => t.subject === val).forEach(t => {
                const opt = document.createElement('option'); opt.value = t.originalIndex; opt.textContent = t.name; topicSelector.appendChild(opt);
            });
        }
        updateTopicQuestionCount();
        randomizeSlogan();
    }

    function updateTopicQuestionCount() {
        const sVal = subjectSelector.value;
        const tVal = topicSelector.value;
        let count = 0;
        if (sVal.startsWith('comprehensive_')) {
            const subj = sVal.replace('comprehensive_', '');
            count = allTopics.filter(t => t.subject === subj).reduce((a, b) => a + b.questions.length, 0);
        } else if (tVal && allTopics[tVal]) count = allTopics[tVal].questions.length;
        topicTotalQuestionsEl.textContent = count;
    }

    function updateUserCupDisplay() {
        const u = allUsersData[currentUserName];
        if (u) {
            if(dashboardHeaderEl) dashboardHeaderEl.textContent = currentUserName;
            const dashCup = document.getElementById('dash-cup');
            if(dashCup) dashCup.textContent = `🏆 ${u.cupCount || 0}`;
            const cupsEl = document.getElementById('start-screen-cups');
            if (cupsEl) cupsEl.textContent = `🏆 ${u.cupCount || 0}`;
            const levelEl = document.getElementById('start-screen-level');
            if (levelEl) levelEl.textContent = calculateLevel(u.lifetimeCorrect || 0);
        }
    }

    function displayUserLog(name) {
        const list = document.getElementById('user-log-list');
        const u = allUsersData[name];
        if (!u || !u.topicResults) { list.innerHTML = '<li>Chưa có dữ liệu</li>'; return; }
        list.innerHTML = '';
        u.topicResults.slice().reverse().forEach(log => {
            const d = new Date(log.date);
            list.innerHTML += `<li class="log-item"><b>${log.topic}</b>: ${log.score}/${log.total} (${log.accuracy}%) - ${d.toLocaleDateString()}</li>`;
        });
    }

    function showVictoryModal(s, a) { document.getElementById('victory-score').textContent = `${s} (${a}%)`; victoryModal.classList.remove('hidden'); try{ sounds.victory.play(); }catch(e){} }
    function startReviewMode() { isReviewMode = true; resultsModal.classList.add('hidden'); victoryModal.classList.add('hidden'); displayQuestion(); updateDashboard(); }
    function resetQuizView() { location.reload(); }

    function updateLeaderboardUI() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        list.innerHTML = '';
        const sortedUsers = Object.entries(allUsersData).sort((a, b) => (b[1].cupCount || 0) - (a[1].cupCount || 0));
        sortedUsers.slice(0, 5).forEach((userEntry, index) => {
            const userName = userEntry[0];
            const li = document.createElement('li');
            li.innerHTML = `<span>${index+1}. <b>${userName}</b></span><span>🏆 ${userEntry[1].cupCount || 0}</span>`;
            list.appendChild(li);
        });
    }

    function updateDashboard() {
        if (document.getElementById('score-value')) document.getElementById('score-value').textContent = lifetimeCorrect;
        if (document.getElementById('correct-value')) document.getElementById('correct-value').textContent = correctAnswers;
        if (document.getElementById('incorrect-value')) document.getElementById('incorrect-value').textContent = incorrectAnswers;
        const total = activeQuestions.length;
        const currentProgress = activeQuestions.length > 0 ? ((correctAnswers + incorrectAnswers) / activeQuestions.length) * 100 : 0;
        if (document.getElementById('progress-bar')) { document.getElementById('progress-bar').style.width = `${currentProgress}%`; document.getElementById('progress-bar').textContent = `${Math.round(currentProgress)}%`; }
        const answered = correctAnswers + incorrectAnswers;
        if (document.getElementById('accuracy-value')) document.getElementById('accuracy-value').textContent = answered > 0 ? `${Math.round((correctAnswers / answered) * 100)}%` : '0%';
    }
    
    function createQuestionNav() {
        questionNavGridEl.innerHTML = '';
        activeQuestions.forEach((_, i) => {
            const navItem = document.createElement('div'); navItem.className = 'nav-item'; navItem.id = `nav-item-${i}`; navItem.textContent = i + 1;
            navItem.addEventListener('click', () => { clearTimeout(autoAdvanceTimeout); currentQuestionIndex = i; displayQuestion(); });
            questionNavGridEl.appendChild(navItem);
        });
    }
    
    function updateQuestionNav(status) {
        const item = document.getElementById(`nav-item-${currentQuestionIndex}`);
        if(item && status !== undefined) { item.classList.remove('current'); item.classList.add(status ? 'correct' : 'incorrect'); }
    }
    
    function startTimer() {
        clearInterval(quizTimer);
        let seconds = 0; 
        if (isReviewMode) { document.getElementById('timer-value').textContent = 'Xem lại'; return; }
        quizStartTime = new Date(); 
        quizTimer = setInterval(() => {
            seconds++; document.getElementById('timer-value').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }, 1000);
    }

    // ==========================================================================
    //  7. AI GURU (FINAL FIX)
    // ==========================================================================

async function callAIGuru(questionObj) {
        aiResponseArea.classList.remove('hidden');
        // Dùng innerHTML để chữ nghiêng đẹp hơn
        aiContentText.innerHTML = "🤖 <i>Gia sư Ivy League đang suy nghĩ...</i>"; 
        
        try {
            // URL Cloudflare của bạn (Giữ nguyên)
            const response = await fetch('https://still-fog-44ed.phungtriduc.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questionObj.question,
                    userAnswer: questionObj.userAnswer,
                    correctAnswer: questionObj.answer,
                    type: questionObj.type,
                    role: "Ivy League STEM Tutor"
                })
            });
            const data = await response.json();

            // --- PHẦN NÂNG CẤP HIỂN THỊ (QUAN TRỌNG) ---
            
            // 1. Xử lý văn bản: Biến **text** thành in đậm, xuống dòng thành <br>
            let formattedReply = data.reply
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')   // Chuyển **...** thành in đậm
                .replace(/\n/g, '<br>');                  // Chuyển xuống dòng

            // 2. Đưa nội dung vào khung
            aiContentText.innerHTML = formattedReply;

            // 3. KÍCH HOẠT MATHJAX (Để dịch mã toán học LaTeX)
            if (window.MathJax) {
                // Yêu cầu MathJax vẽ lại công thức trong khung AI
                MathJax.typesetPromise([aiContentText]).catch((err) => console.log(err));
            }
            // ---------------------------------------------

        } catch (error) {
            console.error(error);
            aiContentText.textContent = "❌ Lỗi kết nối AI. Kiểm tra lại đường truyền nhé Bruno!";
        }
    }


    // ==========================================================================
    //  8. INIT
    // ==========================================================================

// --- BỔ SUNG: KÍCH HOẠT CÁC NÚT TRONG BẢNG KẾT QUẢ & CHIẾN THẮNG ---

    // 1. Xử lý nút "Làm bài mới" (Ở cả bảng Thua và Thắng)
    const newGameBtn = document.getElementById('new-random-btn');
    const newGameVicBtn = document.getElementById('new-random-victory-btn');
    
    const startNewGame = () => {
        resultsModal.classList.add('hidden');
        victoryModal.classList.add('hidden');
        startQuiz('random'); // Mặc định chơi chế độ ngẫu nhiên
    };

    if(newGameBtn) newGameBtn.addEventListener('click', startNewGame);
    if(newGameVicBtn) newGameVicBtn.addEventListener('click', startNewGame);

    // 2. Xử lý nút "Xem lại đáp án" (Ở bảng Chiến thắng - bảng Thua đã có rồi)
    const reviewVicBtn = document.getElementById('review-victory-btn');
    if(reviewVicBtn) reviewVicBtn.addEventListener('click', startReviewMode);

    // 3. Xử lý nút "Quay về trang chủ" (Ở bảng Chiến thắng)
    const homeVicBtn = document.getElementById('go-home-victory-btn');
    if(homeVicBtn) homeVicBtn.addEventListener('click', resetQuizView);

    // 4. Xử lý nút "In báo cáo" (Tạm dùng chung hàm in báo cáo tổng)
    const printDetailBtn = document.getElementById('print-detail-report-btn');
    const printVicBtn = document.getElementById('print-detail-victory-btn');
    
    if(printDetailBtn) printDetailBtn.addEventListener('click', handlePrintSummaryReport);
    if(printVicBtn) printVicBtn.addEventListener('click', handlePrintSummaryReport);

    // --------------------------------------------------------------------


function initializeApp() {
        allUsersData = JSON.parse(localStorage.getItem(ALL_USERS_DB_KEY)) || {};
        const lastUser = localStorage.getItem(LAST_USER_KEY);
        loadAndParseAllTopics();
        updateLeaderboardUI();
        
        // --- PHẦN SỬA LỖI ---
        if (lastUser && allUsersData[lastUser]) {
            // Trường hợp 1: Đã có người dùng cũ -> Hiện màn hình Welcome
            currentUserName = lastUser;
            document.getElementById('welcome-user').classList.remove('hidden');
            document.getElementById('welcome-prompt').classList.add('hidden');
            document.getElementById('user-signature').textContent = currentUserName;
            document.getElementById('user-log-container').classList.remove('hidden');
            updateUserCupDisplay();
            displayUserLog(currentUserName);
        } else {
            // Trường hợp 2: Chưa có người dùng -> HIỆN Ô NHẬP TÊN
            document.getElementById('welcome-user').classList.add('hidden');
            document.getElementById('welcome-prompt').classList.remove('hidden'); // Dòng quan trọng bị thiếu
        }
        // ---------------------

        populateSubjectSelector();
    }

    document.getElementById('start-random-btn').addEventListener('click', () => startQuiz('random'));
    document.getElementById('start-full-btn').addEventListener('click', () => startQuiz('full'));
    subjectSelector.addEventListener('change', handleSubjectChange);
    topicSelector.addEventListener('change', updateTopicQuestionCount);
    nextQuestionBtn.addEventListener('click', handleNextQuestion);
    if(prevQuestionBtn) prevQuestionBtn.addEventListener('click', handlePrevQuestion);
    stopQuizBtn.addEventListener('click', resetQuizView);
    document.getElementById('go-home-btn').addEventListener('click', resetQuizView);
    document.getElementById('review-btn').addEventListener('click', startReviewMode);
    
    const printBtn = document.getElementById('print-summary-report-btn');
    if(printBtn) printBtn.addEventListener('click', handlePrintSummaryReport);
    
    // --- XỬ LÝ NHẬP TÊN (ĐÃ SỬA LẠI GỌN GÀNG) ---
    document.getElementById('name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const name = e.target.value.trim();
            if (name.length > 0) {
                localStorage.setItem(LAST_USER_KEY, name);
                if (!allUsersData[name]) { 
                    allUsersData[name] = { cupCount: 0, lifetimeCorrect: 0, topicResults: [], seenQuestionIds: {} }; 
                    localStorage.setItem(ALL_USERS_DB_KEY, JSON.stringify(allUsersData)); 
// --- [NEW A90] GỬI ĐIỂM VỀ GOOGLE SHEETS ---
        // Thay link dưới đây bằng Link Web App bạn vừa copy ở Bước 2
        const GOOGLE_SCRIPT_URL = "  https://script.google.com/macros/s/AKfycbyoztj_qCAVbFQhSlj4U0IHrZZwEWlkHQ4NR9VandMGvKw8G4fhhQCuazqPBCr013Ut/exec "; 
        
        const dataToSend = {
            name: currentUserName,
            topic: currentQuizTitle,
            score: correctAnswers,
            total: activeQuestions.length,
            acc: acc
        };

        // Gửi ngầm (không làm phiền người dùng)
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Quan trọng để không bị chặn
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        }).then(() => console.log("Đã gửi điểm về Trụ sở!")).catch(err => console.error("Lỗi gửi điểm:", err));
        // -------------------------------------------




                }
                initializeApp();
            } else { 
                alert("Vui lòng nhập tên hợp lệ!"); 
            }
        }
    });

    document.getElementById('change-name-btn').addEventListener('click', () => { 
        localStorage.removeItem(LAST_USER_KEY); 
        initializeApp(); 
    });
    
    document.getElementById('reset-db-btn').addEventListener('click', () => { 
        if(confirm("Xóa toàn bộ dữ liệu?")) { 
            localStorage.clear(); 
            location.reload(); 
        } 
    });

    document.querySelectorAll('.collapsed h3').forEach(h => h.addEventListener('click', function() {
        this.parentElement.classList.toggle('collapsed');
    }));

    // --- BỔ SUNG LOGIC NÚT AI (ĐẶT Ở ĐÂY MỚI ĐÚNG) ---
    if (askAiBtn) {
        askAiBtn.onclick = () => {
            // Kiểm tra xem đã có câu hỏi chưa
            if (!activeQuestions || activeQuestions.length === 0) return;
            
            const currentQ = activeQuestions[currentQuestionIndex];
            
            // Bắt buộc làm xong mới được hỏi (Kỷ luật sắt)
            if (!currentQ.isAnswered) {
                alert("🚫 Woodie phải hoàn thành câu hỏi này trước khi hỏi Gia sư AI!");
                return;
            }
            
            // Gọi hàm xử lý AI
            callAIGuru(currentQ);
        };
    }
    // -------------------------------------------------

    // KHỞI CHẠY ỨNG DỤNG
    initializeApp();

}); // Dấu đóng của DOMContentLoaded (QUAN TRỌNG)