interface UserBubbleProps {
  content: string;
}

export default function UserBubble({ content }: UserBubbleProps) {
  return (
    <div className="flex justify-end w-full">
      <div
        className="rounded-2xl px-4 py-3 text-sm"
        style={{
          maxWidth: '80%',
          background: 'linear-gradient(135deg, var(--accent-purple), rgba(168,85,247,0.7))',
          color: '#fff',
          boxShadow: '0 0 15px rgba(168,85,247,0.3)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  );
}
