import React, { useCallback, useEffect, useState } from 'react';
import { FileQuestion, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { DifficultyLevel, QuestionItem, QuestionType, SubjectItem } from '../../types';

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  short_answer: 'Short Answer',
  essay: 'Essay',
};

const DIFFICULTY_STYLES: Record<DifficultyLevel, string> = {
  easy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  hard: 'text-red-700 bg-red-50 border-red-200',
};

export function QuestionBankPage() {
  const { showToast } = useToast();

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionItem | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('mcq');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [expectedAnswer, setExpectedAnswer] = useState('');
  const [marks, setMarks] = useState<number>(5);
  const [subjectId, setSubjectId] = useState('');
  const [topic, setTopic] = useState('General');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{
        questions: QuestionItem[];
        pagination: { total: number; page: number; pages: number };
      }>('/questions', {
        params: {
          search: search.trim() || undefined,
          subjectId: subjectFilter || undefined,
          topic: topicFilter.trim() || undefined,
          difficulty: difficultyFilter || undefined,
          questionType: typeFilter || undefined,
          page,
          limit: 15,
        },
      });
      setQuestions(data.questions || []);
      setPagination(data.pagination);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load questions.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, subjectFilter, topicFilter, difficultyFilter, typeFilter, page, showToast]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    api
      .get<{ subjects: SubjectItem[] }>('/subjects')
      .then((res) => setSubjects(res.data.subjects || []))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setQuestionText('');
    setQuestionType('mcq');
    setOptions(['', '', '', '']);
    setCorrectAnswer('');
    setExpectedAnswer('');
    setMarks(5);
    setSubjectId(subjects[0]?._id || '');
    setTopic('General');
    setDifficulty('medium');
    setExplanation('');
    setModalOpen(true);
  };

  const openEdit = (q: QuestionItem) => {
    setEditing(q);
    setQuestionText(q.questionText);
    setQuestionType(q.questionType);
    setOptions(
      q.options && q.options.length >= 4
        ? q.options
        : [...(q.options || []), '', '', '', ''].slice(0, 4)
    );
    setCorrectAnswer(q.correctAnswer || '');
    setExpectedAnswer(q.expectedAnswer || '');
    setMarks(q.marks);
    setSubjectId(typeof q.subjectId === 'object' ? q.subjectId._id : q.subjectId);
    setTopic(q.topic || 'General');
    setDifficulty(q.difficulty || 'medium');
    setExplanation(q.explanation || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !subjectId) {
      showToast('Question text and subject are required.', 'error');
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (questionType === 'mcq') {
      if (cleanOptions.length < 4) {
        showToast('Multiple choice questions require at least 4 non-empty options.', 'error');
        return;
      }
      if (!correctAnswer || !cleanOptions.includes(correctAnswer)) {
        showToast('Please select which option is the correct answer.', 'error');
        return;
      }
    }

    if (questionType === 'true_false' && !['True', 'False'].includes(correctAnswer)) {
      showToast('Select True or False as the correct answer.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        questionText: questionText.trim(),
        questionType,
        options: questionType === 'mcq' ? cleanOptions : questionType === 'true_false' ? ['True', 'False'] : [],
        correctAnswer:
          questionType === 'mcq' || questionType === 'true_false' ? correctAnswer : '',
        expectedAnswer:
          questionType === 'short_answer' || questionType === 'essay' ? expectedAnswer.trim() : '',
        marks: Number(marks) || 1,
        subjectId,
        topic: topic.trim() || 'General',
        difficulty,
        explanation: explanation.trim(),
      };

      if (editing) {
        const { data } = await api.put(`/questions/${editing._id}`, payload);
        showToast(data.message, 'success');
      } else {
        const { data } = await api.post('/questions', payload);
        showToast(data.message, 'success');
      }
      setModalOpen(false);
      loadQuestions();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save question.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/questions/${deleteTarget._id}`);
      showToast(data.message, 'success');
      setDeleteTarget(null);
      loadQuestions();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete question.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Question Bank</h1>
          <p className="mt-1 text-sm text-slate-500">
            Author, organize, and filter MCQ, True/False, Short Answer, and Essay items.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Question</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search question text or topic..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => {
            setSubjectFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s._id} value={s._id}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All Types</option>
          <option value="mcq">Multiple Choice</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short Answer</option>
          <option value="essay">Essay</option>
        </select>
        <div className="flex gap-2">
          <select
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <input
            type="text"
            value={topicFilter}
            onChange={(e) => {
              setTopicFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Topic..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No questions match your filters"
          description="Create questions in your subject bank to reuse across manual and randomized exams."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Create First Question
            </button>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Question</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4 text-right">Marks</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {questions.map((q) => (
                  <tr key={q._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5 max-w-md">
                      <p className="font-medium text-slate-900 line-clamp-2">{q.questionText}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Topic: {q.topic}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {typeof q.subjectId === 'object' ? q.subjectId?.code : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {TYPE_LABELS[q.questionType]}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium capitalize rounded border ${
                          DIFFICULTY_STYLES[q.difficulty]
                        }`}
                      >
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {q.marks}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(q)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                          title="Edit Question"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(q)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Question Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Question' : 'Create Question'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Question Type
                  </label>
                  <select
                    value={questionType}
                    disabled={Boolean(editing)}
                    onChange={(e) => {
                      const next = e.target.value as QuestionType;
                      setQuestionType(next);
                      setCorrectAnswer(next === 'true_false' ? 'True' : '');
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50"
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="essay">Essay Question</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marks</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Graph Traversal"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Question Prompt / Statement
                </label>
                <textarea
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  required
                  placeholder="Enter clear, unambiguous question text..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {questionType === 'mcq' && (
                <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Answer Options (select the correct option)
                    </span>
                    <button
                      type="button"
                      onClick={() => setOptions([...options, ''])}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      + Add Option
                    </button>
                  </div>
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="correct-mcq"
                        checked={Boolean(opt.trim()) && correctAnswer === opt.trim()}
                        onChange={() => setCorrectAnswer(opt.trim())}
                        className="text-indigo-600 focus:ring-indigo-500"
                        title="Mark as correct answer"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...options];
                          const prevTrim = updated[idx].trim();
                          updated[idx] = e.target.value;
                          if (correctAnswer === prevTrim) {
                            setCorrectAnswer(e.target.value.trim());
                          }
                          setOptions(updated);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                      {options.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                          className="text-xs text-red-600 hover:text-red-700 px-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {questionType === 'true_false' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    Correct Answer
                  </span>
                  <div className="flex items-center gap-6">
                    {['True', 'False'].map((val) => (
                      <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="correct-tf"
                          checked={correctAnswer === val}
                          onChange={() => setCorrectAnswer(val)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {(questionType === 'short_answer' || questionType === 'essay') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expected Answer / Grading Rubric
                  </label>
                  <textarea
                    rows={3}
                    value={expectedAnswer}
                    onChange={(e) => setExpectedAnswer(e.target.value)}
                    placeholder="Key points or grading criteria for manual evaluation..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Explanation (shown to students after results are published)
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Optional solution rationale..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Question"
        description="Are you sure you want to delete this question from the bank? Questions attached to existing exams cannot be deleted."
        confirmLabel="Delete Question"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
