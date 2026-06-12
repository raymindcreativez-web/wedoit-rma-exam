import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, FileSpreadsheet, CheckCircle, 
  AlertCircle, Bot, BookOpen, ChevronRight, Check,
  Upload, Download, FileText, CheckSquare, BarChart3, Settings, HelpCircle,
  RefreshCw
} from 'lucide-react';

// === API CONFIGURATION ===
const apiKey = ""; // Provided by execution environment

// === INITIAL PRE-LOADED 47-ITEM DATABASE ===
const generateInitialDb = () => {
  const db = {};
  for (let i = 1; i <= 47; i++) {
    const qId = `Q${i}`;
    
    // Pre-populate actual actual questions and standards from Grades 7-10 RMA guidelines
    if (i === 1) {
      db[qId] = {
        question: "Your classmate said that each of the four expressions in Box 1 is equivalent to 1. Evaluate the expression: 4 x 4 - 5 x 3. Show computation.",
        rubric: `Full Credit (2 pts): Correct computation: 16 - 15 = 1.\nPartial Credit (1 pt): 4 x 4 - 5 x 3 = 1; or 16 - 15 only.\nNo Credit (0 pts): Incorrect application of MDAS or other responses.`,
        maxScore: 2
      };
    } else if (i === 2) {
      db[qId] = {
        question: "Give an example of a number expression based on patterns observed. (Target: 6 x 6 - 7 x 5)",
        rubric: `Full Credit (1 pt): 6 x 6 - 7 x 5.\nNo Credit (0 pts): Other expressions.`,
        maxScore: 1
      };
    } else if (i === 3) {
      db[qId] = {
        question: "Identify the correct equivalent expressions based on Box 1 patterns.",
        rubric: `Full Credit (2 pts): b and c.\nPartial Credit (1 pt): b only or c only.\nNo Credit (0 pts): Any responses containing a, d, or e.`,
        maxScore: 2
      };
    } else if (i === 47) {
      db[qId] = {
        question: "A cylindrical road roller covers a specific distance in 5 rolls. What is the total degree measure rotated by the roller?",
        rubric: `Full Credit (2 pts): 1800 degrees. Explanation: 360 degrees x 5 rolls = 1800.\nPartial Credit (1 pt): Responses showing 360 x 5 rolls, or wrong computation but able to set up 360 x 5 rolls.\nNo Credit (0 pts): Other responses.`,
        maxScore: 2
      };
    } else {
      // Dynamic fallback placeholders so Q4 to Q46 are NEVER missing
      // Constructed-response-heavy items (e.g., word problems, geometry, expressions) are auto-assigned 2 pts.
      const isTwoPointer = [5, 10, 15, 20, 24, 25, 30, 35, 40, 42, 43, 44, 45, 46].includes(i);
      db[qId] = {
        question: `Question ${i} details (Select file or import RMA7_10_que.md to customize)`,
        rubric: isTwoPointer 
          ? `Full Credit (2 pts): Correct final answer and complete step-by-step solution.\nPartial Credit (1 pt): Correct setup with minor calculation errors, or incomplete answer.\nNo Credit (0 pts): Incorrect setup/solution.`
          : `Full Credit (1 pt): Correct multiple-choice selection or short-answer response.\nNo Credit (0 pts): Incorrect option selected or no answer.`,
        maxScore: isTwoPointer ? 2 : 1
      };
    }
  }
  return db;
};

const DEFAULT_SHEET_DATA = `Name\tID\tGender\tGrade\tSection\tScore\tPercentage\tResponse 1\tResponse 2\tResponse 3\tResponse 4\tResponse 47
Raymond Fradejas\t111184885585\tMale\tGrade 10\tNeptune\t8 / 72\t100%\t16 - 15 = 1\t6 x 6 - 7 x 5\tb and c\tOption A\t1800 degrees
Maria Clara\t222284885585\tFemale\tGrade 10\tVenus\t5 / 72\t60%\t"4x4=16, 5x3=15, so 2"\t5 x 5 - 4\tb only\tOption B\t360 * 5 = 1500`;

export default function App() {
  const [activeTab, setActiveTab] = useState('import');
  const [sheetData, setSheetData] = useState(DEFAULT_SHEET_DATA);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [evaluations, setEvaluations] = useState({}); 
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Dynamic Rubric database state preloaded with standard template of 47 questions
  const [rubricDb, setRubricDb] = useState(generateInitialDb());
  const [keyFileName, setKeyFileName] = useState("");
  const [queFileName, setQueFileName] = useState("");

  const fileInputRef = useRef(null);
  const keyInputRef = useRef(null);
  const queInputRef = useRef(null);

  // Parse TSV/CSV data
  const parseDelimitedText = (text) => {
    const firstLine = text.split('\n')[0] || '';
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuote = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i+1];
      
      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentCell += '"'; 
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\n' || char === '\r') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') i++; 
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
            rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    if (currentCell || text[text.length-1] === delimiter) {
      currentRow.push(currentCell.trim());
    }
    if (currentRow.length > 0 && currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
    }
    
    return rows;
  };

  // Upgraded Bulletproof Questionnaire Parser (RMA7_10_que.md)
  const parseQuestionnaire = (text) => {
    const questions = {};
    // Split by numbers followed by dots, e.g., "\n1. " or "\n45. "
    const blocks = text.split(/(?:\n|^)\s*(\d+)\.\s+/);
    
    for (let i = 1; i < blocks.length; i += 2) {
      const qNum = blocks[i].trim();
      let qContent = blocks[i+1] || '';
      
      let cleaned = qContent
        .replace(/\{width=[^\}]+\}/g, '') 
        .replace(/height=[^\s\}]+/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\[Refer to Figure \d+\]/gi, '')
        .trim();

      if (cleaned.length > 300) {
        cleaned = cleaned.substring(0, 300) + "...";
      }

      questions[`Q${qNum}`] = cleaned;
    }
    return questions;
  };

  // Upgraded Bulletproof Scoring Guide Parser (RMA7_10_key.md)
  const parseScoringGuide = (text) => {
    const rubrics = {};
    // Split key guidelines by Item boundaries
    const blocks = text.split(/(?:>|\n|^)\s*Item\s*#\s*(\d+)/gi);

    for (let i = 1; i < blocks.length; i += 2) {
      const qNum = blocks[i].trim();
      const blockContent = blocks[i+1] || '';
      const qKey = `Q${qNum}`;

      const cleanCell = (cell) => {
        return cell ? cell.replace(/^[|>\s*-]+/, '').replace(/\||>+/g, '').replace(/\s+/g, ' ').trim() : '';
      };

      const fullMatch = blockContent.match(/Full\s*credit\s*\|?\s*>?\s*([\s\S]+?)(?:Partial\s*credit|No\s*credit|Item\s*#|$)/i);
      const partialMatch = blockContent.match(/Partial\s*credit\s*\|?\s*>?\s*([\s\S]+?)(?:No\s*credit|Item\s*#|$)/i);
      const noMatch = blockContent.match(/No\s*credit\s*\|?\s*>?\s*([\s\S]+?)(?:Item\s*#|$)/i);

      let rubricStr = "";
      let maxScore = 1;

      if (fullMatch) {
        const rawFull = fullMatch[1];
        const scoreMatch = rawFull.match(/\|\s*>\s*(\d+)\s*\|/) || 
                           rawFull.match(/\|\s*(\d+)\s*\|/) || 
                           rawFull.match(/>\s*(\d+)\s*$/m) || 
                           rawFull.match(/(\d+)\s*$/m);
        if (scoreMatch) {
          maxScore = parseInt(scoreMatch[1], 10);
        }
        rubricStr += `Full Credit (${maxScore} pts): ${cleanCell(rawFull)}\n`;
      }
      if (partialMatch) {
        const rawPartial = partialMatch[1];
        const scoreMatch = rawPartial.match(/\|\s*>\s*(\d+)\s*\|/) || 
                           rawPartial.match(/\|\s*(\d+)\s*\|/) || 
                           rawPartial.match(/>\s*(\d+)\s*$/m);
        const pScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 1;
        rubricStr += `Partial Credit (${pScore} pt): ${cleanCell(rawPartial)}\n`;
      }
      if (noMatch) {
        rubricStr += `No Credit (0 pts): ${cleanCell(noMatch[1])}`;
      }

      if (!rubricStr.trim()) {
        rubricStr = blockContent.replace(/\+[-+=]+\+/g, '').replace(/\|[-|\s]+\|/g, '').substring(0, 400).trim();
      }

      rubrics[qKey] = {
        rubric: rubricStr.trim(),
        maxScore: maxScore
      };
    }
    return rubrics;
  };

  const handleKeyFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setKeyFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const rubrics = parseScoringGuide(evt.target.result);
        setRubricDb(prev => {
          const newDb = { ...prev };
          Object.entries(rubrics).forEach(([qId, data]) => {
            newDb[qId] = {
              ...newDb[qId],
              rubric: data.rubric,
              maxScore: data.maxScore,
              question: newDb[qId]?.question || `Question ${qId.substring(1)}`
            };
          });
          return newDb;
        });
      } catch (err) {
        setErrorMessage("Could not parse key file format properly.");
      }
    };
    reader.readAsText(file);
  };

  const handleQueFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQueFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const questions = parseQuestionnaire(evt.target.result);
        setRubricDb(prev => {
          const newDb = { ...prev };
          Object.entries(questions).forEach(([qId, qText]) => {
            newDb[qId] = {
              ...newDb[qId],
              question: qText,
              rubric: newDb[qId]?.rubric || "No rubric configured yet.",
              maxScore: newDb[qId]?.maxScore || 1
            };
          });
          return newDb;
        });
      } catch (err) {
        setErrorMessage("Could not parse questionnaire file format.");
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setSheetData(evt.target.result);
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  const handleImport = () => {
    const lines = parseDelimitedText(sheetData.trim());
    if (lines.length < 1) {
      setErrorMessage("Please provide valid CSV/TSV data.");
      return;
    }

    const firstCell = lines[0][0].toLowerCase();
    const hasHeaders = firstCell.includes('name') || firstCell === 'student' || firstCell.includes('timestamp');
    const headers = hasHeaders ? lines[0] : [];
    const dataRows = hasHeaders ? lines.slice(1) : lines;

    const parsedStudents = [];
    const initialEvaluations = { ...evaluations };

    dataRows.forEach((row, i) => {
      if (row.length === 0 || !row[0]) return;

      let name = row[0];
      let studentId = `stu_${i}`;
      const answers = {};

      const is7MetaFormat = row.length > 7 && (
        /male|female/i.test(row[2] || '') || 
        /grade/i.test(row[3] || '') || 
        /%/.test(row[6] || '')
      );

      if (is7MetaFormat) {
        studentId = row[1] || `stu_${i}`;
        for (let j = 7; j < row.length; j++) {
          let qId = `Q${j - 6}`; 
          
          if (hasHeaders && headers[j]) {
            const match = headers[j].trim().match(/^(?:Response|Q|Item)\s*(\d+)/i);
            if (match) qId = `Q${match[1]}`;
          }
          
          if (row[j] && row[j].trim() !== '') {
            answers[qId] = row[j].trim();
          }
        }
      } else if (hasHeaders) {
        headers.forEach((header, index) => {
          const h = header.trim();
          if (h.toLowerCase() !== 'student name' && h.toLowerCase() !== 'name' && row[index]) {
            let qId = h;
            const match = h.match(/^(?:Response|Q|Item)\s*(\d+)/i);
            if (match) qId = `Q${match[1]}`;
            answers[qId] = row[index].trim();
          }
        });
      } else {
        for (let j = 1; j < row.length; j++) {
          const qId = `Q${j}`;
          if (row[j] && row[j].trim() !== '') {
            answers[qId] = row[j].trim();
          }
        }
      }

      if (Object.keys(answers).length > 0) {
        parsedStudents.push({ id: studentId, name, answers });

        if (!initialEvaluations[studentId]) {
          initialEvaluations[studentId] = {};
          Object.keys(answers).forEach(qId => {
            initialEvaluations[studentId][qId] = {
              aiScore: null, aiExplanation: "", finalScore: null, status: 'pending' 
            };
          });
        }
      }
    });

    if (parsedStudents.length === 0) {
      setErrorMessage("Could not parse any student answers. Check formatting.");
      return;
    }

    setStudents(parsedStudents);
    setEvaluations(initialEvaluations);
    setActiveTab('grading');
    setSelectedStudentId(parsedStudents[0].id);
  };

  const handleExport = () => {
    if (students.length === 0) return;
    
    const questionIds = Array.from(new Set(students.flatMap(s => Object.keys(s.answers))))
      .sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, '')));
    
    let csvContent = "Student ID,Student Name,";
    
    questionIds.forEach(qId => {
      csvContent += `"${qId} Raw Answer","${qId} AI Score","${qId} Final Score","${qId} AI Explanation",`;
    });
    csvContent += "Total Final Score\n";
    
    const esc = (str) => str ? String(str).replace(/"/g, '""') : "";
    
    students.forEach(student => {
      let row = `"${student.id}","${esc(student.name)}",`;
      let totalScore = 0;
      
      questionIds.forEach(qId => {
        const answer = student.answers[qId] || "";
        const evalData = evaluations[student.id]?.[qId] || {};
        const aiScore = evalData.aiScore !== null ? evalData.aiScore : "";
        const finalScore = evalData.finalScore !== null ? evalData.finalScore : "";
        const explanation = evalData.aiExplanation || "";
        
        if (finalScore !== "") totalScore += Number(finalScore);
        
        row += `"${esc(answer)}","${aiScore}","${finalScore}","${esc(explanation)}",`;
      });
      row += `"${totalScore}"\n`;
      csvContent += row;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'RMA_Evaluation_Results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const evaluateWithGemini = async (questionId, studentAnswer) => {
    const qData = rubricDb[questionId];
    if (!qData) return null;

    const prompt = `You are an expert mathematics teacher grading a student's assessment.
    
Question: ${qData.question}
Grading Rubric: ${qData.rubric}
Student's Answer: "${studentAnswer}"

Evaluate the student's answer strictly based on the rubric. 
1. Determine the score the student deserves.
2. Provide a short, constructive explanation of why they received this score.

Respond using this JSON schema ONLY:
{
  "suggestedScore": number,
  "explanation": "string"
}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            suggestedScore: { type: "NUMBER" },
            explanation: { type: "STRING" }
          }
        }
      }
    };

    let retries = 5;
    let backoff = 1000;

    while (retries > 0) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty response from API");

        return JSON.parse(text);
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.error("Failed to fetch from Gemini:", err);
          return { suggestedScore: 0, explanation: "Error communicating with AI evaluator. Please grade manually." };
        }
        await delay(backoff);
        backoff *= 2;
      }
    }
  };

  const handleEvaluateSingle = async (studentId, questionId, answer) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [questionId]: { ...prev[studentId][questionId], status: 'evaluating' }
      }
    }));

    const result = await evaluateWithGemini(questionId, answer);

    if (result) {
      setEvaluations(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [questionId]: {
            ...prev[studentId][questionId],
            aiScore: result.suggestedScore,
            aiExplanation: result.explanation,
            status: 'ai_evaluated'
          }
        }
      }));
    }
  };

  const handleEvaluateAllForStudent = async (student) => {
    setIsEvaluating(true);
    for (const [qId, answer] of Object.entries(student.answers)) {
      if (evaluations[student.id][qId]?.status === 'pending' || evaluations[student.id][qId]?.status === 'evaluating') {
        await handleEvaluateSingle(student.id, qId, answer);
      }
    }
    setIsEvaluating(false);
  };

  const handleSetFinalScore = (studentId, questionId, score) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [questionId]: {
          ...prev[studentId][questionId],
          finalScore: Number(score),
          status: 'graded'
        }
      }
    }));
  };

  const handleManualMaxScoreChange = (qId, scoreVal) => {
    setRubricDb(prev => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        maxScore: Number(scoreVal)
      }
    }));
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-slate-200 bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">RMA Grader</h1>
          </div>
          <p className="text-indigo-100 text-sm mt-1">AI-Assisted Evaluation</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <button
            onClick={() => setActiveTab('import')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors
              ${activeTab === 'import' ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            Data Source & Keys
          </button>

          <button
            onClick={() => setActiveTab('analysis')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors
              ${activeTab === 'analysis' ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <BarChart3 className="w-5 h-5" />
            Scoring Analysis ({Object.keys(rubricDb).length})
          </button>
          
          <div className="px-6 py-3 mt-4 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Students ({students.length})</span>
          </div>
          
          {students.length === 0 ? (
            <div className="px-6 py-3 text-sm text-slate-400 italic">No students loaded</div>
          ) : (
            <div className="space-y-1">
              {students.map(student => {
                const stEvals = evaluations[student.id] || {};
                const total = Object.keys(student.answers).length;
                const graded = Object.values(stEvals).filter(e => e.status === 'graded').length;
                const isComplete = total > 0 && graded === total;

                return (
                  <button
                    key={student.id}
                    onClick={() => {
                      setActiveTab('grading');
                      setSelectedStudentId(student.id);
                    }}
                    className={`w-full flex flex-col px-6 py-2 transition-colors text-left
                      ${activeTab === 'grading' && selectedStudentId === student.id 
                        ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' 
                        : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-medium truncate">{student.name}</span>
                      {isComplete && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {graded} / {total} Graded
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Global Action Bottom */}
        {students.length > 0 && (
          <div className="p-4 border-t border-slate-200">
             <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Scores (CSV)
              </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Custom Error Banner */}
        {errorMessage && (
          <div className="bg-rose-100 text-rose-800 px-6 py-3 border-b border-rose-200 flex justify-between items-center shrink-0">
            <span className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {errorMessage}
            </span>
            <button onClick={() => setErrorMessage("")} className="text-rose-500 hover:text-rose-700 font-bold text-xs">Dismiss</button>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Reference Files Block */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                  Assessment Keys & Questions Configuration
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Upload your Assessment Questionnaire and Key to configure all questions dynamically.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Upload RMA Key */}
                  <div className="border border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                    <FileText className="w-8 h-8 text-indigo-500 mb-2" />
                    <span className="text-sm font-semibold text-slate-700 mb-1">
                      {keyFileName || "Scoring Guide (RMA7_10_key.md)"}
                    </span>
                    <button 
                      onClick={() => keyInputRef.current.click()}
                      className="mt-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      Choose Scoring Guide
                    </button>
                    <input 
                      type="file" 
                      accept=".md,.txt" 
                      ref={keyInputRef} 
                      onChange={handleKeyFileUpload} 
                      className="hidden" 
                    />
                  </div>

                  {/* Upload RMA Questionnaire */}
                  <div className="border border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
                    <FileText className="w-8 h-8 text-teal-500 mb-2" />
                    <span className="text-sm font-semibold text-slate-700 mb-1">
                      {queFileName || "Questionnaire (RMA7_10_que.md)"}
                    </span>
                    <button 
                      onClick={() => queInputRef.current.click()}
                      className="mt-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      Choose Questionnaire
                    </button>
                    <input 
                      type="file" 
                      accept=".md,.txt" 
                      ref={queInputRef} 
                      onChange={handleQueFileUpload} 
                      className="hidden" 
                    />
                  </div>

                </div>
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">
                    Active Question Configuration: {Object.keys(rubricDb).length} questions loaded.
                  </span>
                </div>
              </div>

              {/* Student Answers Source */}
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Student Answers (TSV / CSV)</h2>
                <p className="text-slate-600 mt-1">
                  Upload your student response spreadsheet or paste your data directly below.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Paste Data or Upload File</span>
                  
                  <input 
                    type="file" 
                    accept=".csv, .tsv, .txt" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    ref={fileInputRef}
                  />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Upload Student Sheets
                  </button>
                </div>
                <textarea
                  value={sheetData}
                  onChange={(e) => setSheetData(e.target.value)}
                  className="w-full h-80 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 whitespace-pre"
                  placeholder="Student Name,Q1,Q2&#10;Juan Dela Cruz,16-15=1,6x6-7x5"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleImport}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  Load Students & Proceed to Grading
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scoring & Rubrics Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                  Scoring & Rubrics Key Analysis
                </h2>
                <p className="text-slate-600 mt-1">
                  Verify loaded maximum scores and grading standards for all loaded questions. You can manually adjust the maximum score of any item if needed.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-4 w-24">Item</th>
                      <th className="p-4">Question Text / Details</th>
                      <th className="p-4 w-48">Scoring Rubrics</th>
                      <th className="p-4 w-32">Max Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {Object.entries(rubricDb)
                      .sort((a, b) => parseInt(a[0].replace(/\D/g, '')) - parseInt(b[0].replace(/\D/g, '')))
                      .map(([qId, qData]) => (
                        <tr key={qId} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-700 align-top">{qId}</td>
                          <td className="p-4 text-slate-600 align-top max-w-xs break-words">
                            <p className="font-medium text-slate-800">{qData.question || "No details loaded"}</p>
                          </td>
                          <td className="p-4 text-xs text-slate-500 font-mono align-top whitespace-pre-wrap max-w-sm">
                            {qData.rubric || "No rubrics defined"}
                          </td>
                          <td className="p-4 align-top">
                            <select
                              value={qData.maxScore}
                              onChange={(e) => handleManualMaxScoreChange(qId, e.target.value)}
                              className="w-24 p-1.5 bg-white border border-slate-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-semibold"
                            >
                              {[1, 2, 3, 4, 5, 10].map(val => (
                                <option key={val} value={val}>{val} Point{val > 1 ? 's' : ''}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Grading Dashboard Tab */}
        {activeTab === 'grading' && selectedStudent && (
          <div className="flex-1 flex flex-col h-full bg-slate-100">
            {/* Student Header */}
            <div className="bg-white px-8 py-6 border-b border-slate-200 shadow-sm z-10 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedStudent.name}</h2>
                <p className="text-slate-500 text-sm mt-1">Reviewing RMA Answers</p>
              </div>
              <button
                onClick={() => handleEvaluateAllForStudent(selectedStudent)}
                disabled={isEvaluating}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isEvaluating ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    AI Analyzing...
                  </span>
                ) : (
                  <>
                    <Bot className="w-5 h-5" />
                    Run AI Evaluation for All
                  </>
                )}
              </button>
            </div>

            {/* Questions Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto space-y-8">
                {Object.entries(selectedStudent.answers).map(([qId, answer]) => {
                  const qData = rubricDb[qId];
                  const evalData = evaluations[selectedStudent.id]?.[qId] || {};

                  if (!qData) {
                    return (
                      <div key={qId} className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
                        <div className="flex items-center gap-2 font-semibold">
                          <AlertCircle className="w-5 h-5" />
                          Unknown Question ID: {qId}
                        </div>
                        <p className="mt-2 text-sm">No rubric configured or parsed for this question. You can configure it dynamically in the Scoring Analysis tab.</p>
                        <div className="mt-3 p-3 bg-white/60 rounded-lg border border-amber-200">
                          <span className="text-sm font-semibold text-amber-800">Student's Answer:</span> <span className="font-mono text-amber-900 ml-2">"{answer}"</span>
                        </div>
                        
                        {/* Fallback to allow teacher to score unknown questions anyway */}
                        <div className="mt-4 border-t border-amber-200 pt-4 flex items-center gap-4">
                           <label className="text-sm font-semibold">Manual Score:</label>
                           <input 
                              type="number"
                              min="0"
                              value={evalData.finalScore ?? ''}
                              onChange={(e) => handleSetFinalScore(selectedStudent.id, qId, e.target.value)}
                              className="w-24 p-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none"
                              placeholder="Score"
                           />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={qId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="flex flex-col lg:flex-row">
                        
                        {/* Left Column: Question & Rubric */}
                        <div className="w-full lg:w-1/2 p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50">
                          <div className="inline-block px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full mb-4">
                            Question {qId}
                          </div>
                          <p className="text-slate-800 font-medium mb-6 leading-relaxed">
                            {qData.question}
                          </p>
                          
                          <div className="mt-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scoring Rubric (Max: {qData.maxScore} pts)</h4>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-600 whitespace-pre-wrap font-mono">
                              {qData.rubric}
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Student Answer & Evaluation */}
                        <div className="w-full lg:w-1/2 p-6 flex flex-col">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student's Answer</h4>
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-indigo-900 text-lg mb-6 break-words">
                            "{answer}"
                          </div>

                          {/* AI Evaluation Section */}
                          <div className="flex-1 flex flex-col">
                            {evalData.status === 'pending' && (
                              <div className="mt-auto bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                                <Bot className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-600 text-sm mb-4">AI evaluation has not been run for this answer yet.</p>
                                <button
                                  onClick={() => handleEvaluateSingle(selectedStudent.id, qId, answer)}
                                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors"
                                >
                                  Evaluate this Answer
                                </button>
                              </div>
                            )}

                            {evalData.status === 'evaluating' && (
                              <div className="mt-auto bg-blue-50 border border-blue-200 rounded-lg p-6 flex flex-col items-center justify-center space-y-4">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-blue-700 font-medium">Gemini is analyzing the answer...</p>
                              </div>
                            )}

                            {(evalData.status === 'ai_evaluated' || evalData.status === 'graded') && (
                              <div className="flex flex-col h-full justify-between space-y-6">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                                      <Bot className="w-5 h-5" />
                                      AI Suggestion
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                      {/* Individual Re-evaluate option */}
                                      <button
                                        onClick={() => handleEvaluateSingle(selectedStudent.id, qId, answer)}
                                        title="Re-run AI evaluation for this question"
                                        className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded text-xs font-semibold transition-colors"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                        Re-evaluate
                                      </button>
                                      
                                      <div className="bg-emerald-200 text-emerald-900 px-3 py-1 rounded-full text-sm font-bold">
                                        {evalData.aiScore} / {qData.maxScore} pts
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-sm text-emerald-800 leading-relaxed">
                                    {evalData.aiExplanation}
                                  </p>
                                </div>

                                {/* Teacher Verification Area */}
                                <div className="border-t border-slate-200 pt-6">
                                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-indigo-600" />
                                    Teacher Verification
                                  </h4>
                                  <div className="mb-4 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-sm">
                                    <span className="text-slate-500 font-medium mr-2">Student's Answer:</span> 
                                    <span className="font-semibold text-indigo-900">"{answer}"</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center gap-3">
                                      <label className="text-sm text-slate-600 whitespace-nowrap">Final Score:</label>
                                      <select
                                        value={evalData.finalScore ?? ''}
                                        onChange={(e) => handleSetFinalScore(selectedStudent.id, qId, e.target.value)}
                                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                      >
                                        <option value="" disabled>Select Score</option>
                                        {[...Array(qData.maxScore + 1)].map((_, i) => (
                                          <option key={i} value={i}>{i} Points</option>
                                        ))}
                                      </select>
                                    </div>
                                    {evalData.status === 'graded' && (
                                      <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                                        <Check className="w-4 h-4" /> Saved
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Navigation to next student */}
                <div className="flex justify-end pt-4">
                  {students.findIndex(s => s.id === selectedStudentId) < students.length - 1 && (
                    <button
                      onClick={() => {
                        const currentIndex = students.findIndex(s => s.id === selectedStudentId);
                        setSelectedStudentId(students[currentIndex + 1].id);
                        window.scrollTo(0,0);
                      }}
                      className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                    >
                      Next Student <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}