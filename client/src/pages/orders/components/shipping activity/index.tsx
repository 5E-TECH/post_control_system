const steps = [
  {
    title: "Order was placed (Order ID: #32543)",
    description: "Your order has been placed successfully",
    time: "Tuesday 11:29 AM",
  },
  {
    title: "Pick-up",
    description: "Pick-up scheduled with courier",
    time: "Wednesday 11:29 AM",
  },
  {
    title: "Dispatched",
    description: "Item has been picked up by courier.",
    time: "Thursday 8:15 AM",
  },
  {
    title: "Package arrived",
    description: "Package arrived at an Amazon facility, NY",
    time: "Saturday 15:20 AM",
  },
  {
    title: "Dispatched for delivery",
    description: "Package has left an Amazon facility, NY",
    time: "Today 14:12 PM",
  },
  {
    title: "Delivery",
    description: "Package will be delivered by tomorrow",
    time: "",
  },
];

export default function ShippingActivity() {
  return (
    <div className="mx-auto p-6">
      <h2 className="text-[18px] font-medium text-[#2E263DE5] mb-6 dark:text-[#E7E3FCE5]">
        Shipping activity
      </h2>

      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-4">
            {/* Line + Dot */}
            <div className="relative flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-purple-500 relative z-10"></span>
              {index !== steps.length - 2 &&  index !== steps.length - 1 && (
                <span className="absolute top-5  left-1.4 w-0.5 h-[42px] bg-purple-300"></span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 gap-1">
              <h3 className="text-[15px] text-[#2E263DE5] font-medium dark:text-[#E7E3FCE5]">
                {step.title}
              </h3>
              <p className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCB2]">{step.description}</p>
            </div>

            {/* Time */}
            <div className="text-[13px] text-[#2E263D66] whitespace-nowrap dark:text-[#E7E3FC66]">
              {step.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
