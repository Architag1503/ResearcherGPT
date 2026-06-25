import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Match dashboard and project workspaces
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/projects(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  // Local environment bypass: if no Clerk keys are detected in dev mode, we bypass redirecting
  const hasClerkKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
                         !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_mock');
  
  if (isProtectedRoute(req) && hasClerkKeys) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
