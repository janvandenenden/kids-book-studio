"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page is deprecated - storyboard creation is now admin-only
// Redirects to home page
export default function CreateStoryboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home - storyboard creation is now done via /admin
    router.push("/");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
        <p className="text-sm text-gray-400 mt-2">
          Storyboard creation is now available at /admin
        </p>
      </div>
    </div>
  );
}
