import { BookForm } from "@/components/BookForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Kids Book Studio
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Create a personalized storybook starring your child! Upload their
            photo and we&apos;ll create a magical illustrated adventure
            featuring a character that looks just like them.
          </p>
        </div>

        {/* Form */}
        <div className="flex justify-center">
          <BookForm />
        </div>

        {/* Features */}
        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📖</div>
            <h3 className="font-semibold text-gray-800 mb-2">Personalized Story</h3>
            <p className="text-gray-600 text-sm">
              Your child becomes the hero of their very own adventure story
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="font-semibold text-gray-800 mb-2">AI Illustrations</h3>
            <p className="text-gray-600 text-sm">
              Beautiful watercolor-style illustrations in a consistent storybook style
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">📥</div>
            <h3 className="font-semibold text-gray-800 mb-2">Download PDF</h3>
            <p className="text-gray-600 text-sm">
              Get a print-ready PDF to read together or print at home
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
