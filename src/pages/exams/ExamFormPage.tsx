import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shuffle } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { ClassItem, ExamStatus, ExamType, QuestionItem, SubjectItem } from '../../types';

function toLocalInputValue(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function ExamFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [bankQuestions, setBankQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [examType, setExamType] = useState<ExamType>('quiz');
  const [startDate, setStartDate] = useState(toLocalInputValue());
  const [endDate, setEndDate] = useState(
    toLocalInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
  );
  const [duration, setDuration] = useState(45);
  const [totalMarks, setTotalMarks] = useState(25);
  const [passingMarks, setPassingMarks] = useState(13);
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [status, setStatus] = useState<ExamStatus>('active');
  const [instructions, setInstructions] = useState(
    'Read every question carefully before answering. Your progress is saved automatically.'
  );

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [randomEnabled, setRandomEnabled] = useState(false);
  const [randomCount, setRandomCount] = useState(5);
  const [randomDifficulty, setRandomDifficulty] = useState('all');

  useEffect(() => {
    Promise.all([
      api.get<{ classes: ClassItem[] }>('/classes'),
      api.get<{ subjects: SubjectItem[] }>('/subjects'),
    ])
      .then(([clsRes, subRes]) => {
        const clsList = clsRes.data.classes || [];
        const subList = subRes.data.subjects || [];
        setClasses(clsList);
        setSubjects(subList);
        if (!isEditing) {
          if (subList[0]) {
            setSubjectId(subList[0]._id);
            const subClassId =
              typeof subList[0].classId === 'object'
                ? subList[0].classId._id
                : subList[0].classId;
            setClassId(subClassId || clsList[0]?._id || '');
          } else if (clsList[0]) {
            setClassId(clsList[0]._id);
          }
        }
      })
      .catch(() => {});
  }, [isEditing]);

  useEffect(() => {
    if (!subjectId) {
      setBankQuestions([]);
      return;
    }
    api
      .get<{ questions: QuestionItem[] }>('/questions', {
        params: { subjectId, limit: 100 },
      })
      .then((res) => setBankQuestions(res.data.questions || []))
      .catch(() => {});
  }, [subjectId]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ exam: any }>(`/exams/${id}`)
      .then((res) => {
        const ex = res.data.exam;
        setTitle(ex.title);
        setDescription(ex.description || '');
        setSubjectId(typeof ex.subjectId === 'object' ? ex.subjectId._id : ex.subjectId);
        setClassId(typeof ex.classId === 'object' ? ex.classId._id : ex.classId);
        setExamType(ex.examType);
        setStartDate(toLocalInputValue(ex.startDate));
        setEndDate(toLocalInputValue(ex.endDate));
        setDuration(ex.duration);
        setTotalMarks(ex.totalMarks);
        setPassingMarks(ex.passingMarks);
        setAttemptsAllowed(ex.attemptsAllowed);
        setStatus(ex.status);
        setInstructions(ex.instructions || '');
        setSelectedQuestionIds(
          (ex.questions || []).map((q: any) => (typeof q === 'object' ? q._id : q))
        );
        if (ex.randomSelection) {
          setRandomEnabled(Boolean(ex.randomSelection.enabled));
          setRandomCount(ex.randomSelection.count || 5);
          setRandomDifficulty(ex.randomSelection.difficulty || 'all');
        }
      })
      .catch((err) => {
        showToast(extractErrorMessage(err, 'Failed to load examination details.'), 'error');
        navigate('/exams');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, showToast]);

  const toggleQuestion = (qId: string) => {
    const next = selectedQuestionIds.includes(qId)
      ? selectedQuestionIds.filter((x) => x !== qId)
      : [...selectedQuestionIds, qId];
    setSelectedQuestionIds(next);

    const marksSum = bankQuestions
      .filter((q) => next.includes(q._id))
      .reduce((acc, q) => acc + q.marks, 0);
    if (marksSum > 0) {
      setTotalMarks(marksSum);
      setPassingMarks(Math.ceil(marksSum * 0.5));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !subjectId || !classId) {
      showToast('Title, subject, and class are required.', 'error');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      showToast('End date/time must be after start date/time.', 'error');
      return;
    }

    if (passingMarks > totalMarks) {
      showToast('Passing marks cannot exceed total marks.', 'error');
      return;
    }

    if (!randomEnabled && selectedQuestionIds.length === 0 && status !== 'draft') {
      showToast('Select at least one question or enable random question selection.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        subjectId,
        classId,
        examType,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        duration: Number(duration),
        totalMarks: Number(totalMarks),
        passingMarks: Number(passingMarks),
        attemptsAllowed: Number(attemptsAllowed),
        status,
        instructions: instructions.trim(),
        questions: randomEnabled ? [] : selectedQuestionIds,
        randomSelection: {
          enabled: randomEnabled,
          count: randomEnabled ? Number(randomCount) : 0,
          difficulty: randomDifficulty,
        },
      };

      if (isEditing) {
        const { data } = await api.put(`/exams/${id}`, payload);
        showToast(data.message, 'success');
      } else {
        const { data } = await api.post('/exams', payload);
        showToast(data.message, 'success');
      }
      navigate('/exams');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save examination.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading examination configuration...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/exams')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Examinations</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {isEditing ? 'Edit Examination' : 'Create Examination'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Examination Details
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Examination Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Assessment: Data Structures"
              required
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of covered modules and topics..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  const matched = subjects.find((s) => s._id === e.target.value);
                  if (matched) {
                    const cls =
                      typeof matched.classId === 'object' ? matched.classId._id : matched.classId;
                    if (cls) setClassId(cls);
                  }
                }}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Examination Type
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
                <option value="midterm">Midterm Examination</option>
                <option value="final">Final Examination</option>
                <option value="practice">Practice Examination</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schedule & Scoring */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Schedule & Scoring Rules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Duration (min)
              </label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
              <input
                type="number"
                min={1}
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Passing Marks</label>
              <input
                type="number"
                min={0}
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Attempts</label>
              <input
                type="number"
                min={1}
                value={attemptsAllowed}
                onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExamStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Student Instructions
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Question Selection */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Examination Questions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick specific questions from the Question Bank or draw a random subset.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={randomEnabled}
                onChange={(e) => setRandomEnabled(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Shuffle className="w-4 h-4 text-indigo-600" />
              <span>Randomize from Question Bank</span>
            </label>
          </div>

          {randomEnabled ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Number of Questions to Draw ({bankQuestions.length} available)
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, bankQuestions.length)}
                  value={randomCount}
                  onChange={(e) => setRandomCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Difficulty Filter
                </label>
                <select
                  value={randomDifficulty}
                  onChange={(e) => setRandomDifficulty(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="hard">Hard Only</option>
                </select>
              </div>
            </div>
          ) : bankQuestions.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              No questions exist yet for this subject. Add questions in Question Bank first.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {bankQuestions.map((q) => {
                const checked = selectedQuestionIds.includes(q._id);
                return (
                  <label
                    key={q._id}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer hover:bg-slate-50 ${
                      checked ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleQuestion(q._id)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{q.questionText}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {q.questionType.replace('_', ' ')} · {q.difficulty} ·{' '}
                        <span className="font-mono">{q.marks} marks</span>
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/exams')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
          >
            {saving ? 'Saving Examination...' : isEditing ? 'Save Changes' : 'Create Examination'}
          </button>
        </div>
      </form>
    </div>
  );
}
