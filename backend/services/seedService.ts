import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';
import { ClassModel } from '../models/Class.ts';
import { Subject } from '../models/Subject.ts';
import { Question } from '../models/Question.ts';
import { Exam } from '../models/Exam.ts';
import { ExamAttempt } from '../models/ExamAttempt.ts';
import { Result } from '../models/Result.ts';
import { DEFAULT_GRADING_SCALE, Settings } from '../models/Settings.ts';

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await Settings.findOne();
  if (!existing) {
    await Settings.create({
      institutionName: 'EXAMPRO Academy',
      academicYear: '2026-2027',
      defaultExamDuration: 60,
      allowSelfRegistration: true,
      gradingScale: DEFAULT_GRADING_SCALE,
    });
  }
}

interface BootstrapInput {
  adminName: string;
  adminEmail: string;
  password: string;
  includeSampleData: boolean;
}

export async function initializeWorkspace(input: BootstrapInput) {
  await ensureDefaultSettings();

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const adminUser = await User.create({
    name: input.adminName,
    email: input.adminEmail.toLowerCase(),
    password: hashedPassword,
    role: 'admin',
    profileImage: '/src/assets/images/avatar_admin_director_1795592793545.jpg',
    status: 'active',
  });

  if (!input.includeSampleData) {
    return { adminUser, sampleAccounts: [] };
  }

  // Create Classes
  const [csClass, engClass, bioClass] = await ClassModel.create([
    {
      name: 'BSc Computer Science — Year 2',
      academicYear: '2026-2027',
      description: 'Core algorithms, discrete mathematics, and systems architecture cohort.',
      status: 'active',
    },
    {
      name: 'Grade 12 — STEM Honors',
      academicYear: '2026-2027',
      description: 'Advanced placement calculus, physics, and analytical writing.',
      status: 'active',
    },
    {
      name: 'BSc Life Sciences — Year 1',
      academicYear: '2026-2027',
      description: 'Foundational organic chemistry, molecular biology, and biostatistics.',
      status: 'active',
    },
  ]);

  // Create Teachers
  const [teacher1, teacher2] = await User.create([
    {
      name: 'Dr. Eleanor Vance',
      email: 'teacher@exampro.edu',
      password: hashedPassword,
      role: 'teacher',
      teacherId: 'TCH-2026-1001',
      phone: '+1 (555) 234-8810',
      profileImage: '/src/assets/images/avatar_faculty_teacher_1795592794370.jpg',
      assignedClasses: [csClass._id, engClass._id],
      status: 'active',
    },
    {
      name: 'Prof. Samuel Okafor',
      email: 'samuel.okafor@exampro.edu',
      password: hashedPassword,
      role: 'teacher',
      teacherId: 'TCH-2026-1002',
      phone: '+1 (555) 234-8814',
      assignedClasses: [bioClass._id, engClass._id],
      status: 'active',
    },
  ]);

  // Create Subjects
  const [algoSub, mathSub, sysSub, chemSub] = await Subject.create([
    {
      name: 'Data Structures & Algorithms',
      code: 'CS-204',
      description: 'Trees, graphs, dynamic programming, and asymptotic complexity.',
      classId: csClass._id,
      teacherId: teacher1._id,
      status: 'active',
    },
    {
      name: 'Applied Calculus & Linear Algebra',
      code: 'MATH-301',
      description: 'Multivariable integration, eigenvalues, and differential systems.',
      classId: engClass._id,
      teacherId: teacher1._id,
      status: 'active',
    },
    {
      name: 'Operating Systems & Concurrency',
      code: 'CS-210',
      description: 'Process scheduling, memory management, and synchronization primitives.',
      classId: csClass._id,
      teacherId: teacher1._id,
      status: 'active',
    },
    {
      name: 'Organic & Analytical Chemistry',
      code: 'CHEM-105',
      description: 'Reaction mechanisms, stereochemistry, and spectroscopy.',
      classId: bioClass._id,
      teacherId: teacher2._id,
      status: 'active',
    },
  ]);

  teacher1.assignedSubjects = [algoSub._id, mathSub._id, sysSub._id];
  await teacher1.save();
  teacher2.assignedSubjects = [chemSub._id];
  await teacher2.save();

  // Create Students
  const [student1, student2, student3, student4] = await User.create([
    {
      name: 'Maya Lin',
      email: 'student@exampro.edu',
      password: hashedPassword,
      role: 'student',
      studentId: 'STU-2026-4001',
      phone: '+1 (555) 890-1102',
      profileImage: '/src/assets/images/avatar_scholar_student_1795592795326.jpg',
      classId: csClass._id,
      status: 'active',
    },
    {
      name: 'Liam Chen',
      email: 'liam.chen@exampro.edu',
      password: hashedPassword,
      role: 'student',
      studentId: 'STU-2026-4002',
      phone: '+1 (555) 890-1105',
      classId: csClass._id,
      status: 'active',
    },
    {
      name: 'Sophia Patel',
      email: 'sophia.patel@exampro.edu',
      password: hashedPassword,
      role: 'student',
      studentId: 'STU-2026-4003',
      phone: '+1 (555) 890-1109',
      classId: csClass._id,
      status: 'active',
    },
    {
      name: 'Daniel Brooks',
      email: 'daniel.brooks@exampro.edu',
      password: hashedPassword,
      role: 'student',
      studentId: 'STU-2026-4004',
      phone: '+1 (555) 890-1112',
      classId: engClass._id,
      status: 'active',
    },
  ]);

  // Create Question Bank
  const algoQuestions = await Question.create([
    {
      questionText: 'What is the worst-case time complexity of searching for an element in a balanced binary search tree (AVL tree) with n nodes?',
      questionType: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correctAnswer: 'O(log n)',
      marks: 5,
      subjectId: algoSub._id,
      topic: 'Balanced Trees',
      difficulty: 'easy',
      explanation: 'AVL trees maintain a height bounded by O(log n), so search traverses at most O(log n) levels.',
      teacherId: teacher1._id,
    },
    {
      questionText: 'Which graph traversal algorithm guarantees finding the shortest path in terms of edge count in an unweighted graph?',
      questionType: 'mcq',
      options: ['Depth-First Search (DFS)', 'Breadth-First Search (BFS)', 'Kruskal Algorithm', 'Topological Sort'],
      correctAnswer: 'Breadth-First Search (BFS)',
      marks: 5,
      subjectId: algoSub._id,
      topic: 'Graph Traversal',
      difficulty: 'easy',
      explanation: 'BFS explores vertices level by level from the source, reaching closer nodes first.',
      teacherId: teacher1._id,
    },
    {
      questionText: 'True or False: Dijkstra’s shortest-path algorithm produces correct shortest paths when a graph contains negative edge weights.',
      questionType: 'true_false',
      options: ['True', 'False'],
      correctAnswer: 'False',
      marks: 5,
      subjectId: algoSub._id,
      topic: 'Shortest Paths',
      difficulty: 'medium',
      explanation: 'Dijkstra assumes greedy relaxation is final once settled; negative edges violate that invariant.',
      teacherId: teacher1._id,
    },
    {
      questionText: 'Explain the trade-off between open addressing and separate chaining when resolving hash table collisions under high load factors.',
      questionType: 'short_answer',
      expectedAnswer: 'Separate chaining handles load factors >= 1 gracefully using linked buckets at the cost of pointer memory, whereas open addressing has better cache locality but suffers from primary/secondary clustering as load approaches 1.',
      marks: 10,
      subjectId: algoSub._id,
      topic: 'Hashing',
      difficulty: 'medium',
      explanation: 'Key rubric points: memory overhead vs cache locality, clustering effects, and load factor sensitivity.',
      teacherId: teacher1._id,
    },
    {
      questionText: 'Design an algorithm to detect cycles in a directed graph and analyze both its time and auxiliary space complexity.',
      questionType: 'essay',
      expectedAnswer: 'Use 3-color DFS (unvisited, visiting, visited) or Kahn’s topological sort algorithm. Both run in O(V + E) time and O(V) auxiliary space.',
      marks: 15,
      subjectId: algoSub._id,
      topic: 'Graph Algorithms',
      difficulty: 'hard',
      explanation: 'Must distinguish directed back-edges from cross-edges using recursion stack tracking.',
      teacherId: teacher1._id,
    },
  ]);

  const sysQuestions = await Question.create([
    {
      questionText: 'Which CPU scheduling policy can suffer from indefinite postponement (starvation) of low-priority processes if aging is not applied?',
      questionType: 'mcq',
      options: ['Round Robin', 'First-Come, First-Served', 'Priority Scheduling', 'Multilevel Feedback Queue with Aging'],
      correctAnswer: 'Priority Scheduling',
      marks: 5,
      subjectId: sysSub._id,
      topic: 'CPU Scheduling',
      difficulty: 'easy',
      teacherId: teacher1._id,
    },
    {
      questionText: 'True or False: A mutex lock and a counting semaphore initialized to 1 have identical ownership semantics in POSIX threads.',
      questionType: 'true_false',
      options: ['True', 'False'],
      correctAnswer: 'False',
      marks: 5,
      subjectId: sysSub._id,
      topic: 'Concurrency',
      difficulty: 'medium',
      explanation: 'A mutex enforces thread ownership (only the locking thread may unlock it), whereas any thread may post to a semaphore.',
      teacherId: teacher1._id,
    },
    {
      questionText: 'In virtual memory systems, what hardware component caches recent virtual-to-physical page translations?',
      questionType: 'mcq',
      options: ['Instruction Pipeline', 'Translation Lookaside Buffer (TLB)', 'Direct Memory Access Controller', 'Page Fault Handler'],
      correctAnswer: 'Translation Lookaside Buffer (TLB)',
      marks: 5,
      subjectId: sysSub._id,
      topic: 'Memory Management',
      difficulty: 'easy',
      teacherId: teacher1._id,
    },
    {
      questionText: 'Briefly describe the four Coffman conditions required for a resource deadlock to occur.',
      questionType: 'short_answer',
      expectedAnswer: 'Mutual exclusion, hold and wait, no preemption, and circular wait.',
      marks: 10,
      subjectId: sysSub._id,
      topic: 'Deadlocks',
      difficulty: 'medium',
      teacherId: teacher1._id,
    },
  ]);

  await Question.create([
    {
      questionText: 'What is the determinant of a 2x2 matrix [[3, 2], [1, 4]]?',
      questionType: 'mcq',
      options: ['10', '14', '8', '6'],
      correctAnswer: '10',
      marks: 5,
      subjectId: mathSub._id,
      topic: 'Matrices',
      difficulty: 'easy',
      teacherId: teacher1._id,
    },
    {
      questionText: 'True or False: Every continuous function on a closed bounded interval [a, b] attains both a maximum and a minimum value.',
      questionType: 'true_false',
      options: ['True', 'False'],
      correctAnswer: 'True',
      marks: 5,
      subjectId: mathSub._id,
      topic: 'Extreme Value Theorem',
      difficulty: 'easy',
      teacherId: teacher1._id,
    },
    {
      questionText: 'Which functional group characterizes a ketone?',
      questionType: 'mcq',
      options: ['Hydroxyl (-OH)', 'Carbonyl (C=O) bonded to two carbons', 'Carboxyl (-COOH)', 'Amino (-NH2)'],
      correctAnswer: 'Carbonyl (C=O) bonded to two carbons',
      marks: 5,
      subjectId: chemSub._id,
      topic: 'Functional Groups',
      difficulty: 'easy',
      teacherId: teacher2._id,
    },
  ]);

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  // Exam 1: Active right now for CS-204 (40 marks total, 20 passing)
  const activeAlgoExam = await Exam.create({
    title: 'Midterm Assessment: Trees, Graphs & Hashing',
    description: 'Comprehensive midterm covering balanced search trees, BFS/DFS, shortest paths, and hash collision strategies.',
    subjectId: algoSub._id,
    classId: csClass._id,
    teacherId: teacher1._id,
    examType: 'midterm',
    questions: algoQuestions.map((q) => q._id),
    startDate: yesterday,
    endDate: nextWeek,
    duration: 45,
    totalMarks: 40,
    passingMarks: 20,
    instructions: 'Answer all 5 questions. Objective questions are graded automatically; short-answer and essay questions are reviewed by Dr. Vance.',
    attemptsAllowed: 2,
    status: 'active',
  });

  // Exam 2: Completed Exam with published & pending results for CS-210 (25 marks total)
  const completedSysExam = await Exam.create({
    title: 'Quiz 1: CPU Scheduling & Virtual Memory',
    description: 'Evaluates foundational understanding of process scheduling, synchronization primitives, and TLB architecture.',
    subjectId: sysSub._id,
    classId: csClass._id,
    teacherId: teacher1._id,
    examType: 'quiz',
    questions: sysQuestions.map((q) => q._id),
    startDate: twoDaysAgo,
    endDate: oneDayAgo,
    duration: 30,
    totalMarks: 25,
    passingMarks: 13,
    instructions: 'Complete all questions within 30 minutes.',
    attemptsAllowed: 1,
    status: 'completed',
  });

  // Exam 3: Upcoming Scheduled Exam
  await Exam.create({
    title: 'Final Examination: Algorithm Design & Complexity',
    description: 'End-of-term cumulative examination on dynamic programming, NP-completeness, and network flow.',
    subjectId: algoSub._id,
    classId: csClass._id,
    teacherId: teacher1._id,
    examType: 'final',
    questions: algoQuestions.slice(0, 3).map((q) => q._id),
    startDate: inThreeDays,
    endDate: inTenDays,
    duration: 90,
    totalMarks: 15,
    passingMarks: 8,
    instructions: 'Closed-book timed examination.',
    attemptsAllowed: 1,
    status: 'scheduled',
  });

  // Seed historical attempts & results on completedSysExam
  const attemptMaya = await ExamAttempt.create({
    studentId: student1._id,
    examId: completedSysExam._id,
    assignedQuestionIds: sysQuestions.map((q) => q._id),
    answers: [
      {
        questionId: sysQuestions[0]._id,
        answer: 'Priority Scheduling',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[1]._id,
        answer: 'False',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[2]._id,
        answer: 'Translation Lookaside Buffer (TLB)',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[3]._id,
        answer: 'Mutual exclusion, hold and wait, no preemption, and circular wait.',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 9,
        isCorrect: true,
        graded: true,
        teacherFeedback: 'Clear and concise enumeration of all four conditions.',
      },
    ],
    startedAt: twoDaysAgo,
    expiresAt: new Date(twoDaysAgo.getTime() + 30 * 60 * 1000),
    submittedAt: oneDayAgo,
    score: 24,
    totalMarks: 25,
    percentage: 96,
    grade: 'A',
    passed: true,
    status: 'graded',
    attemptNumber: 1,
  });

  await Result.create({
    studentId: student1._id,
    examId: completedSysExam._id,
    attemptId: attemptMaya._id,
    marksObtained: 24,
    totalMarks: 25,
    percentage: 96,
    grade: 'A',
    passed: true,
    feedback: 'Excellent grasp of operating system concurrency and hardware address translation.',
    gradingStatus: 'graded',
    published: true,
    publishedAt: oneDayAgo,
  });

  // Liam Chen: submitted, pending manual grading for short answer
  const attemptLiam = await ExamAttempt.create({
    studentId: student2._id,
    examId: completedSysExam._id,
    assignedQuestionIds: sysQuestions.map((q) => q._id),
    answers: [
      {
        questionId: sysQuestions[0]._id,
        answer: 'Priority Scheduling',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[1]._id,
        answer: 'True',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 0,
        isCorrect: false,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[2]._id,
        answer: 'Translation Lookaside Buffer (TLB)',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[3]._id,
        answer: 'A deadlock needs circular waiting, holding resources while requesting others, non-preemptive allocation, and mutual exclusion.',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 0,
        isCorrect: false,
        graded: false,
        teacherFeedback: '',
      },
    ],
    startedAt: twoDaysAgo,
    expiresAt: new Date(twoDaysAgo.getTime() + 30 * 60 * 1000),
    submittedAt: oneDayAgo,
    score: 10,
    totalMarks: 25,
    percentage: 40,
    grade: 'F',
    passed: false,
    status: 'submitted',
    attemptNumber: 1,
  });

  await Result.create({
    studentId: student2._id,
    examId: completedSysExam._id,
    attemptId: attemptLiam._id,
    marksObtained: 10,
    totalMarks: 25,
    percentage: 40,
    grade: 'F',
    passed: false,
    feedback: '',
    gradingStatus: 'pending',
    published: false,
  });

  // Sophia Patel: graded & published B
  const attemptSophia = await ExamAttempt.create({
    studentId: student3._id,
    examId: completedSysExam._id,
    assignedQuestionIds: sysQuestions.map((q) => q._id),
    answers: [
      {
        questionId: sysQuestions[0]._id,
        answer: 'Priority Scheduling',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[1]._id,
        answer: 'False',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 5,
        isCorrect: true,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[2]._id,
        answer: 'Page Fault Handler',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 0,
        isCorrect: false,
        graded: true,
        teacherFeedback: '',
      },
      {
        questionId: sysQuestions[3]._id,
        answer: 'Mutual exclusion, hold and wait, no preemption, and circular wait.',
        flagged: false,
        savedAt: oneDayAgo,
        marksAwarded: 8,
        isCorrect: true,
        graded: true,
        teacherFeedback: 'Good explanation; remember TLB handles address translation caching.',
      },
    ],
    startedAt: twoDaysAgo,
    expiresAt: new Date(twoDaysAgo.getTime() + 30 * 60 * 1000),
    submittedAt: oneDayAgo,
    score: 18,
    totalMarks: 25,
    percentage: 72,
    grade: 'B',
    passed: true,
    status: 'graded',
    attemptNumber: 1,
  });

  await Result.create({
    studentId: student3._id,
    examId: completedSysExam._id,
    attemptId: attemptSophia._id,
    marksObtained: 18,
    totalMarks: 25,
    percentage: 72,
    grade: 'B',
    passed: true,
    feedback: 'Solid performance overall. Review virtual memory hardware components.',
    gradingStatus: 'graded',
    published: true,
    publishedAt: oneDayAgo,
  });

  return {
    adminUser,
    activeExamId: activeAlgoExam._id,
    sampleAccounts: [
      { role: 'admin', email: adminUser.email, name: adminUser.name },
      { role: 'teacher', email: teacher1.email, name: teacher1.name },
      { role: 'student', email: student1.email, name: student1.name },
    ],
  };
}
