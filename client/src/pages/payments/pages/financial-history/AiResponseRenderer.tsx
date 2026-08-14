import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// AI javobini boy (rangli, haqiqiy jadvalli) markdown sifatida ko'rsatadi.
// react-markdown xom HTML'ni render QILMAYDI (XSS xavfsiz).
const AiResponseRenderer: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }: any) => (
            <h1 className="text-base font-bold text-purple-700 dark:text-purple-300 mt-2 mb-1">
              {children}
            </h1>
          ),
          h2: ({ children }: any) => (
            <h2 className="text-sm font-bold text-purple-700 dark:text-purple-300 mt-2 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }: any) => (
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-1.5 mb-0.5">
              {children}
            </h3>
          ),
          p: ({ children }: any) => <p className="my-1.5">{children}</p>,
          strong: ({ children }: any) => (
            <strong className="font-bold text-gray-900 dark:text-white">
              {children}
            </strong>
          ),
          em: ({ children }: any) => (
            <em className="italic text-gray-600 dark:text-gray-300">{children}</em>
          ),
          ul: ({ children }: any) => (
            <ul className="list-disc pl-5 space-y-1 my-1.5">{children}</ul>
          ),
          ol: ({ children }: any) => (
            <ol className="list-decimal pl-5 space-y-1 my-1.5">{children}</ol>
          ),
          li: ({ children }: any) => (
            <li className="marker:text-purple-400">{children}</li>
          ),
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-r-lg px-3 py-2 my-2 text-gray-700 dark:text-gray-200">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-2 border-gray-200 dark:border-gray-700/50" />
          ),
          code: ({ children }: any) => (
            <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-purple-600 dark:text-purple-300 text-xs">
              {children}
            </code>
          ),
          a: ({ children, href }: any) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 dark:text-purple-400 underline"
            >
              {children}
            </a>
          ),
          table: ({ children }: any) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-gray-200 dark:border-gray-700/60 shadow-sm">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }: any) => (
            <thead className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              {children}
            </thead>
          ),
          th: ({ children }: any) => (
            <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
              {children}
            </th>
          ),
          tbody: ({ children }: any) => <tbody>{children}</tbody>,
          tr: ({ children }: any) => (
            <tr className="odd:bg-white even:bg-gray-50 dark:odd:bg-[#2A263D] dark:even:bg-[#241f36] border-t border-gray-100 dark:border-gray-700/50">
              {children}
            </tr>
          ),
          td: ({ children }: any) => (
            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-200 whitespace-nowrap">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default AiResponseRenderer;
