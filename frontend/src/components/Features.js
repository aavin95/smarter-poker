export default function Features() {
    return (
      <div className="container mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard title="Real-Time Games" description="Play with real players at any time from anywhere in the world." />
        <FeatureCard title="Secure Transactions" description="Your deposits and winnings are protected with advanced security measures." />
        <FeatureCard title="24/7 Support" description="Access our dedicated support team any time of the day." />
      </div>
    );
  }
  
  function FeatureCard({ title, description }) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
        <h3 className="text-lg font-semibold text-dark">{title}</h3>
        <p className="text-gray-600 mt-2">{description}</p>
      </div>
    );
  }
  