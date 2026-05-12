/* ============================================================================
   VLearning — Shared TypeScript Types
   ============================================================================
   Central type definitions shared across the frontend application.
   Keep types co-located with their domain when they grow complex.
   ============================================================================ */

/* -------------------------------------------------------------------------- */
/*  User / Auth                                                                */
/* -------------------------------------------------------------------------- */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "student" | "teacher" | "admin";
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Teacher                                                                    */
/* -------------------------------------------------------------------------- */

export interface Teacher {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  specializations: string[];
  coursesCount: number;
  studentsCount: number;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Course                                                                     */
/* -------------------------------------------------------------------------- */

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  price: number;
  currency: string;
  teacherId: string;
  teacher?: Teacher;
  status: "draft" | "published" | "archived";
  enrollmentsCount: number;
  lessonsCount: number;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  API Response Wrappers                                                      */
/* -------------------------------------------------------------------------- */

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
