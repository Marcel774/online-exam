import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Send,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ExamAttemptItem, ExamItem, QuestionItem } from '../../types';

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TakeExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [exam, setExam] = useState<ExamItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<string, { answer: string; flagged: boolean }>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedText, setLastSavedText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const deadlineAnchorRef = useRef<number>(0);
  const autoSubmittedRef = useRef<boolean>(false);
  const answersMapRef = useRef(answersMap);
  answersMapRef.current = answersMap;

  const buildAnswerPayload = useCallback(() => {
    return questions.map((q) => ({
      questionId: q._id,
      answer: answersMapRef.current[q._id]?.answer || '',
      flagged: Boolean(answersMapRef.current[q._id]?.flagged),
    }));
  }, [questions]);

  const persistAnswers = useCallback(async () => {
    if (!attemptId || questions.length === 0) return;
    setSaveState('saving');
    try {
      const { data } = await api.put<{ savedAt: string; remainingSeconds: number }>(
        `/attempts/${attemptId}/answers`,
        { answers: buildAnswerPayload() }
      );
      deadlineAnchorRef.current = Date.now() + data.remainingSeconds * 1000;
      setSaveState('saved');
      setLastSavedText(new Date(data.savedAt).toLocaleTimeString());
    } catch {
      setSaveState('error');
    }
  }, [attemptId, buildAnswerPayload, questions.length]);

  const executeSubmit = useCallback(
    async (isAuto = false) => {
      if (!attemptId || submitting || autoSubmittedRef.current) return;
      autoSubmittedRef.current = true;
      setSubmitting(true);
      try {
        await api.post(`/attempts/${attemptId}/submit`, {
          answers: buildAnswerPayload(),
        });
        showToast(
          isAuto
            ? 'Time expired — your examination was automatically submitted.'
            : 'Examination submitted successfully!',
          isAuto ? 'info' : 'success'
        );
        navigate('/student/history', { replace: true });
      } catch (err) {
        autoSubmittedRef.current = false;
        showToast(extractErrorMessage(err, 'Submission error.'), 'error');
        setConfirmOpen(false);
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId, buildAnswerPayload, navigate, showToast, submitting]
  );

  useEffect(() => {
    if (!attemptId) return;
    setLoading(true);
    api
      .get<{
        attempt: ExamAttemptItem;
        exam: ExamItem;
        questions: QuestionItem[];
        remainingSeconds: number;
      }>(`/attempts/${attemptId}`)
      .then((res) => {
        const { attempt, exam: examData, questions: qs, remainingSeconds: rem } = res.data;
        if (attempt.status !== 'in_progress') {
          showToast('This examination attempt has already been submitted.', 'info');
          navigate('/student/history', { replace: true });
          return;
        }
        setExam(examData);
        setQuestions(qs);
        const initMap: Record<string, { answer: string; flagged: boolean }> = {};
        for (const a of attempt.answers || []) {
          initMap[a.questionId] = { answer: a.answer || '', flagged: Boolean(a.flagged) };
        }
        setAnswersMap(initMap);
        deadlineAnchorRef.current = Date.now() + rem * 1000;
        setRemainingSeconds(rem);
      })
      .catch((err) => {
        showToast(extractErrorMessage(err, 'Failed to load examination session.'), 'error');
        navigate('/student/exams/available');
      })
      .finally(() => setLoading(false));
  }, [attemptId, navigate, showToast]);

  // Server-anchored countdown timer
  useEffect(() => {
    if (loading || questions.length === 0) return;

    const tick = setInterval(() => {
      const secs = Math.max(0, Math.floor((deadlineAnchorRef.current - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs <= 0 && !autoSubmittedRef.current) {
        clearInterval(tick);
        executeSubmit(true);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [loading, questions.length, executeSubmit]);

  // Periodic background autosave every 20 seconds
  useEffect(() => {
    if (loading || questions.length === 0) return;
    const interval = setInterval(() => {
      persistAnswers();
    }, 20000);
    return () => clearInterval(interval);
  }, [loading, questions.length, persistAnswers]);

  // Debounced autosave on answer edits
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateAnswer = (questionId: string, answer: string) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: { answer, flagged: prev[questionId]?.flagged || false },
    }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistAnswers();
    }, 900);
  };

  const toggleFlag = (questionId: string) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: {
        answer: prev[questionId]?.answer || '',
        flagged: !prev[questionId]?.flagged,
      },
    }));
  };

  if (loading || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600 font-medium">Loading examination environment...</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const answeredCount = questions.filter((q) => (answersMap[q._id]?.answer || '').trim() !== '').length;
  const unansweredCount = questions.length - answeredCount;
  const timerUrgent = remainingSeconds <= 60;
  const timerWarning = remainingSeconds > 60 && remainingSeconds <= 300;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Focused Exam Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 truncate">
              {typeof exam.subjectId === 'object' ? `${exam.subjectId.code} · ${exam.subjectId.name}` : 'Examination'}
            </p>
            <h1 className="font-display text-base sm:text-lg font-bold truncate">{exam.title}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {/* Save indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300">
              {saveState === 'saving' && <span>Saving answers...</span>}
              {saveState === 'saved' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved {lastSavedText}</span>
                </>
              )}
              {saveState === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Save retry queued</span>
                </>
              )}
            </div>

            {/* Countdown Timer */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-mono text-sm font-bold tabular-nums border ${
                timerUrgent
                  ? 'bg-red-950/80 border-red-500 text-red-200'
                  : timerWarning
                  ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                  : 'bg-slate-800 border-slate-700 text-white'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatSeconds(remainingSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                persistAnswers();
                setConfirmOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Submit Exam</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question Area */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          {currentQuestion && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900 text-sm tabular-nums">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  <span>·</span>
                  <span className="capitalize">{currentQuestion.questionType.replace('_', ' ')}</span>
                  <span>·</span>
                  <span className="font-mono font-medium text-slate-700 tabular-nums">
                    {currentQuestion.marks} mark(s)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestion._id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    answersMap[currentQuestion._id]?.flagged
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>
                    {answersMap[currentQuestion._id]?.flagged ? 'Flagged' : 'Flag for Review'}
                  </span>
                </button>
              </div>

              <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
                {currentQuestion.questionText}
              </div>

              {/* Answer Controls */}
              {(currentQuestion.questionType === 'mcq' ||
                currentQuestion.questionType === 'true_false') && (
                <div className="space-y-3 pt-2">
                  {(currentQuestion.options || []).map((option, oIdx) => {
                    const selected = answersMap[currentQuestion._id]?.answer === option;
                    return (
                      <label
                        key={oIdx}
                        className={`flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-indigo-50/70 border-indigo-500 text-slate-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQuestion._id}`}
                          checked={selected}
                          onChange={() => updateAnswer(currentQuestion._id, option)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm sm:text-base">{option}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {(currentQuestion.questionType === 'short_answer' ||
                currentQuestion.questionType === 'essay') && (
                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Your Written Response
                  </label>
                  <textarea
                    rows={currentQuestion.questionType === 'essay' ? 9 : 4}
                    value={answersMap[currentQuestion._id]?.answer || ''}
                    onChange={(e) => updateAnswer(currentQuestion._id, e.target.value)}
                    placeholder="Type your response clearly here..."
                    className="w-full p-4 text-sm sm:text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>
              )}

              {/* Prev / Next Bar */}
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => {
                    persistAnswers();
                    setCurrentIdx((i) => Math.max(0, i - 1));
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={persistAnswers}
                  className="px-3.5 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                >
                  Save Answer
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      persistAnswers();
                      setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      persistAnswers();
                      setConfirmOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                  >
                    <span>Review & Submit</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Question Navigation Panel */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Question Navigator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {answeredCount} of {questions.length} answered
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIdx;
              const isAnswered = (answersMap[q._id]?.answer || '').trim() !== '';
              const isFlagged = Boolean(answersMap[q._id]?.flagged);

              let btnStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
              if (isFlagged) {
                btnStyle = 'bg-amber-50 border-amber-400 text-amber-800';
              } else if (isAnswered) {
                btnStyle = 'bg-indigo-600 border-indigo-600 text-white';
              }

              return (
                <button
                  key={q._id}
                  type="button"
                  onClick={() => {
                    persistAnswers();
                    setCurrentIdx(idx);
                  }}
                  className={`h-10 rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors ${btnStyle} ${
                    isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-indigo-600 inline-block" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400 inline-block" />
              <span>Flagged for review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 inline-block" />
              <span>Unanswered ({unansweredCount})</span>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit Examination"
        variant="primary"
        description={
          unansweredCount > 0
            ? `You have ${unansweredCount} unanswered question(s) remaining. Once submitted, you cannot edit your responses for this attempt.`
            : `All ${questions.length} questions have been answered. Confirm final submission of your examination.`
        }
        confirmLabel="Submit Final Answers"
        loading={submitting}
        onConfirm={() => executeSubmit(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
