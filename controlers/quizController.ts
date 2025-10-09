import { Elysia, t } from 'elysia';
import Quiz from '../models/Quiz';
import QuizAttempt from '../models/QuizAttempt';
import Course from '../models/Course';
import User from '../models/User';

export const quizController = new Elysia({ prefix: '/api/quiz' })
  
  // Create a new quiz (Admin only)
  .post('/create', async ({ body, headers }) => {
    try {
      const token = headers.authorization?.replace('Bearer ', '');
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const { courseId, moduleId, title, description, instructions, questions, duration, passingScore, attempts, showResults, showCorrectAnswers, randomizeQuestions } = body as any;
      
      // Calculate total points
      const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);

      const quiz = new Quiz({
        courseId,
        moduleId: moduleId || undefined, // Optional module ID
        title,
        description,
        instructions,
        questions: questions.map((q: any, index: number) => ({
          id: q.id || `q${index + 1}`,
          question: q.question,
          type: q.type,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points || 1
        })),
        duration: duration || 30,
        passingScore: passingScore || 70,
        totalPoints,
        attempts: attempts || 3,
        showResults: showResults !== false,
        showCorrectAnswers: showCorrectAnswers !== false,
        randomizeQuestions: randomizeQuestions || false,
        isPublished: false,
        createdBy: userId
      });

      await quiz.save();
      
      console.log(`Quiz created: ${quiz.title} by ${user.email}`);

      return {
        success: true,
        message: 'Quiz created successfully',
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          totalPoints: quiz.totalPoints,
          questionCount: quiz.questions.length
        }
      };
    } catch (error) {
      console.error('Error creating quiz:', error);
      return { success: false, message: 'Failed to create quiz' };
    }
  })

  // Get all quizzes (Admin only)
  .get('/all', async ({ headers }) => {
    try {
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const quizzes = await Quiz.find().populate('courseId', 'title').sort({ createdAt: -1 });

      // Get attempt counts for each quiz
      const quizzesWithDetails = await Promise.all(
        quizzes.map(async (quiz) => {
          const attemptCount = await QuizAttempt.countDocuments({
            quizId: quiz._id
          });

          return {
            _id: quiz._id,
            title: quiz.title,
            description: quiz.description,
            courseTitle: (quiz.courseId as any)?.title || 'Unknown Course',
            duration: quiz.duration,
            totalPoints: quiz.totalPoints,
            passingScore: quiz.passingScore,
            questionCount: quiz.questions.length,
            totalAttempts: attemptCount,
            isPublished: quiz.isPublished,
            createdAt: quiz.createdAt
          };
        })
      );

      return {
        success: true,
        quizzes: quizzesWithDetails
      };
    } catch (error) {
      console.error('Error fetching all quizzes:', error);
      return { success: false, message: 'Failed to fetch quizzes' };
    }
  })

  // Get quiz by ID (Admin only - for editing)
  .get('/:quizId', async ({ params, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const quiz = await Quiz.findById(quizId).populate('courseId', 'title');

      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      return {
        success: true,
        quiz: {
          _id: quiz._id,
          courseId: (quiz.courseId as any)?._id || quiz.courseId,
          moduleId: quiz.moduleId,
          title: quiz.title,
          description: quiz.description,
          instructions: quiz.instructions,
          questions: quiz.questions,
          duration: quiz.duration,
          passingScore: quiz.passingScore,
          maxAttempts: quiz.attempts,
          settings: {
            showResults: quiz.showResults,
            showCorrectAnswers: quiz.showCorrectAnswers,
            randomizeQuestions: quiz.randomizeQuestions
          },
          totalPoints: quiz.totalPoints,
          isPublished: quiz.isPublished,
          createdAt: quiz.createdAt
        }
      };
    } catch (error) {
      console.error('Error fetching quiz:', error);
      return { success: false, message: 'Failed to fetch quiz' };
    }
  })

  // Update quiz (Admin only)
  .put('/:quizId', async ({ params, body, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const { courseId, moduleId, title, description, instructions, questions, duration, passingScore, maxAttempts, settings } = body as any;
      
      // Calculate total points
      const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);

      const quiz = await Quiz.findById(quizId);
      
      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      // Update quiz fields
      quiz.courseId = courseId;
      quiz.moduleId = moduleId || undefined;
      quiz.title = title;
      quiz.description = description;
      quiz.instructions = instructions;
      quiz.questions = questions.map((q: any, index: number) => ({
        id: q.id || `q${index + 1}`,
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points || 1
      }));
      quiz.duration = duration || 30;
      quiz.passingScore = passingScore || 70;
      quiz.totalPoints = totalPoints;
      quiz.attempts = maxAttempts || 3;
      quiz.showResults = settings?.showResults !== false;
      quiz.showCorrectAnswers = settings?.showCorrectAnswers !== false;
      quiz.randomizeQuestions = settings?.randomizeQuestions || false;

      await quiz.save();
      
      console.log(`Quiz updated: ${quiz.title} by ${user.email}`);

      return {
        success: true,
        message: 'Quiz updated successfully',
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          totalPoints: quiz.totalPoints,
          questionCount: quiz.questions.length
        }
      };
    } catch (error) {
      console.error('Error updating quiz:', error);
      return { success: false, message: 'Failed to update quiz' };
    }
  })

  // Delete quiz (Admin only)
  .delete('/:quizId', async ({ params, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const quiz = await Quiz.findById(quizId);
      
      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      // Delete all quiz attempts for this quiz
      await QuizAttempt.deleteMany({ quizId: quizId });
      
      // Delete the quiz
      await Quiz.findByIdAndDelete(quizId);
      
      console.log(`Quiz deleted: ${quiz.title} by ${user.email}`);

      return {
        success: true,
        message: 'Quiz and all associated attempts deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting quiz:', error);
      return { success: false, message: 'Failed to delete quiz' };
    }
  })

  // Get all quizzes for a course
  .get('/course/:courseId', async ({ params, headers }) => {
    try {
      const { courseId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Check if user has access to the course
      const hasPurchased = user.purchasedCourses?.some(
        (purchase: any) => {
          const purchasedId = purchase.courseId?.toString() || purchase.toString();
          return purchasedId === courseId;
        }
      );

      if (!hasPurchased && user.userType !== 'admin') {
        return { success: false, message: 'Course not purchased' };
      }

      const quizzes = await Quiz.find({ 
        courseId,
        $or: [
          { isPublished: true },
          { createdBy: userId } // Show unpublished quizzes to creator
        ]
      }).select('-questions.correctAnswer -questions.explanation'); // Hide answers

      // Get attempt counts for each quiz
      const quizzesWithAttempts = await Promise.all(
        quizzes.map(async (quiz) => {
          const attempts = await QuizAttempt.countDocuments({
            quizId: quiz._id,
            userId
          });

          return {
            _id: quiz._id,
            title: quiz.title,
            moduleId: quiz.moduleId,
            description: quiz.description,
            duration: quiz.duration,
            totalPoints: quiz.totalPoints,
            passingScore: quiz.passingScore,
            questionCount: quiz.questions.length,
            attempts: attempts,
            maxAttempts: quiz.attempts,
            isPublished: quiz.isPublished
          };
        })
      );

      return {
        success: true,
        quizzes: quizzesWithAttempts
      };
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      return { success: false, message: 'Failed to fetch quizzes' };
    }
  })

  // Get a specific quiz for taking (Student)
  .get('/:quizId/start', async ({ params, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      // Check if quiz is published
      if (!quiz.isPublished && quiz.createdBy !== userId) {
        return { success: false, message: 'Quiz not available' };
      }

      // Check course access
      const hasPurchased = user.purchasedCourses?.some(
        (purchase: any) => {
          const purchasedId = purchase.courseId?.toString() || purchase.toString();
          return purchasedId === quiz.courseId;
        }
      );

      if (!hasPurchased && user.userType !== 'admin') {
        return { success: false, message: 'Course not purchased' };
      }

      // Check attempt limit
      const attemptCount = await QuizAttempt.countDocuments({
        quizId: quiz._id,
        userId
      });

      if (quiz.attempts !== -1 && attemptCount >= quiz.attempts) {
        return { success: false, message: 'Maximum attempts reached' };
      }

      // Randomize questions if enabled
      let questions = quiz.questions.map(q => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options,
        points: q.points
      }));

      if (quiz.randomizeQuestions) {
        questions = questions.sort(() => Math.random() - 0.5);
      }

      return {
        success: true,
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          instructions: quiz.instructions,
          questions,
          duration: quiz.duration,
          totalPoints: quiz.totalPoints,
          passingScore: quiz.passingScore,
          currentAttempt: attemptCount + 1,
          maxAttempts: quiz.attempts
        }
      };
    } catch (error) {
      console.error('Error starting quiz:', error);
      return { success: false, message: 'Failed to start quiz' };
    }
  })

  // Submit quiz attempt
  .post('/:quizId/submit', async ({ params, body, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const { answers, timeSpent, startedAt } = body as any;

      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      // Calculate score
      let score = 0;
      const gradedAnswers = answers.map((answer: any) => {
        const question = quiz.questions.find(q => q.id === answer.questionId);
        if (!question) return null;

        // Support both 'answer' and 'userAnswer' for backwards compatibility
        const userAnswer = answer.userAnswer || answer.answer;

        let isCorrect = false;
        if (question.type === 'multiple-choice') {
          isCorrect = userAnswer === question.correctAnswer;
        } else if (question.type === 'true-false') {
          isCorrect = userAnswer === question.correctAnswer;
        } else if (question.type === 'short-answer') {
          // Simple case-insensitive comparison
          isCorrect = userAnswer.toLowerCase().trim() === 
                     (question.correctAnswer as string).toLowerCase().trim();
        }

        const pointsEarned = isCorrect ? question.points : 0;
        score += pointsEarned;

        return {
          questionId: answer.questionId,
          userAnswer,
          isCorrect,
          pointsEarned
        };
      }).filter(Boolean);

      const percentage = Math.round((score / quiz.totalPoints) * 100);
      const passed = percentage >= quiz.passingScore;

      // Get attempt number
      const attemptCount = await QuizAttempt.countDocuments({
        quizId: quiz._id,
        userId
      });

      const attempt = new QuizAttempt({
        quizId: quiz._id,
        userId,
        courseId: quiz.courseId,
        answers: gradedAnswers,
        score,
        totalPoints: quiz.totalPoints,
        percentage,
        passed,
        timeSpent,
        startedAt: new Date(startedAt),
        submittedAt: new Date(),
        attemptNumber: attemptCount + 1
      });

      await attempt.save();

      console.log(`Quiz submitted: ${quiz.title} by user ${userId}, Score: ${percentage}%`);

      // Prepare response based on quiz settings
      const response: any = {
        success: true,
        attemptId: attempt._id,
        score,
        totalPoints: quiz.totalPoints,
        percentage,
        passed,
        attemptNumber: attempt.attemptNumber
      };

      if (quiz.showResults) {
        response.results = {
          score,
          totalPoints: quiz.totalPoints,
          percentage,
          passed,
          timeSpent
        };

        if (quiz.showCorrectAnswers) {
          response.answers = gradedAnswers.map((answer: any) => {
            const question = quiz.questions.find(q => q.id === answer.questionId);
            return {
              ...answer,
              correctAnswer: question?.correctAnswer,
              explanation: question?.explanation
            };
          });
        }
      }

      return response;
    } catch (error) {
      console.error('Error submitting quiz:', error);
      return { success: false, message: 'Failed to submit quiz' };
    }
  })

  // Get quiz attempts for a student
  .get('/attempts/:courseId', async ({ params, headers }) => {
    try {
      const { courseId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;

      const attempts = await QuizAttempt.find({
        userId,
        courseId
      }).sort({ submittedAt: -1 });

      // Get quiz details
      const attemptsWithQuizzes = await Promise.all(
        attempts.map(async (attempt) => {
          const quiz = await Quiz.findById(attempt.quizId);
          return {
            _id: attempt._id,
            quizId: attempt.quizId,  // Add quizId to response
            quizTitle: quiz?.title,
            score: attempt.score,
            totalPoints: attempt.totalPoints,
            percentage: attempt.percentage,
            passed: attempt.passed,
            timeSpent: attempt.timeSpent,
            submittedAt: attempt.submittedAt,
            attemptNumber: attempt.attemptNumber
          };
        })
      );

      return {
        success: true,
        attempts: attemptsWithQuizzes
      };
    } catch (error) {
      console.error('Error fetching attempts:', error);
      return { success: false, message: 'Failed to fetch attempts' };
    }
  })

  // Publish/Unpublish quiz (Admin)
  .patch('/:quizId/publish', async ({ params, body, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const { isPublished } = body as any;
      
      const quiz = await Quiz.findByIdAndUpdate(
        quizId,
        { isPublished },
        { new: true }
      );

      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      return {
        success: true,
        message: isPublished ? 'Quiz published' : 'Quiz unpublished',
        quiz: {
          _id: quiz._id,
          isPublished: quiz.isPublished
        }
      };
    } catch (error) {
      console.error('Error publishing quiz:', error);
      return { success: false, message: 'Failed to update quiz' };
    }
  })

  // Update quiz (Admin)
  .put('/:quizId', async ({ params, body, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const updateData = body as any;
      
      // Recalculate total points if questions are updated
      if (updateData.questions) {
        updateData.totalPoints = updateData.questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
      }

      const quiz = await Quiz.findByIdAndUpdate(
        quizId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      return {
        success: true,
        message: 'Quiz updated successfully',
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          description: quiz.description
        }
      };
    } catch (error) {
      console.error('Error updating quiz:', error);
      return { success: false, message: 'Failed to update quiz' };
    }
  })

  // Delete quiz (Admin)
  .delete('/:quizId', async ({ params, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const quiz = await Quiz.findByIdAndDelete(quizId);

      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      // Delete all attempts for this quiz
      await QuizAttempt.deleteMany({ quizId });

      return {
        success: true,
        message: 'Quiz deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting quiz:', error);
      return { success: false, message: 'Failed to delete quiz' };
    }
  })

  // Get quiz results/analytics (Admin)
  .get('/:quizId/results', async ({ params, headers }) => {
    try {
      const { quizId } = params;
      const token = headers.authorization?.replace('Bearer ', '');
      
      if (!token || token === 'undefined' || token === 'null') {
        return { success: false, message: 'Authentication required' };
      }

      const userId = token;
      const user = await User.findById(userId);
      
      if (!user || user.userType !== 'admin') {
        return { success: false, message: 'Admin access required' };
      }

      const quiz = await Quiz.findById(quizId).populate('courseId', 'title');
      if (!quiz) {
        return { success: false, message: 'Quiz not found' };
      }

      // Get all attempts for this quiz
      const attempts = await QuizAttempt.find({ quizId })
        .populate('userId', 'username email profile')
        .sort({ submittedAt: -1 });

      // Calculate statistics
      const totalParticipants = new Set(attempts.map(a => a.userId.toString())).size;
      const totalAttempts = attempts.length;
      const scores = attempts.map(a => a.percentage);
      const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const passRate = attempts.length > 0 ? (attempts.filter(a => a.passed).length / attempts.length) * 100 : 0;
      const averageTime = attempts.length > 0 ? attempts.reduce((sum, a) => sum + a.timeSpent, 0) / attempts.length : 0;

      // Group attempts by student
      const studentAttempts = attempts.map(attempt => ({
        _id: attempt._id,
        studentName: (attempt.userId as any).username,
        studentEmail: (attempt.userId as any).email,
        score: attempt.score,
        percentage: attempt.percentage,
        passed: attempt.passed,
        attemptNumber: attempt.attemptNumber,
        timeSpent: attempt.timeSpent,
        submittedAt: attempt.submittedAt
      }));

      return {
        success: true,
        quiz: {
          _id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          courseTitle: (quiz.courseId as any)?.title,
          totalPoints: quiz.totalPoints,
          passingScore: quiz.passingScore,
          questionCount: quiz.questions.length,
          duration: quiz.duration
        },
        statistics: {
          totalParticipants,
          totalAttempts,
          averageScore: Math.round(averageScore * 10) / 10,
          passRate: Math.round(passRate * 10) / 10,
          averageTime: Math.round(averageTime),
          highestScore: Math.max(...scores, 0),
          lowestScore: Math.min(...scores, 100)
        },
        attempts: studentAttempts
      };
    } catch (error) {
      console.error('Error fetching quiz results:', error);
      return { success: false, message: 'Failed to fetch quiz results' };
    }
  });
