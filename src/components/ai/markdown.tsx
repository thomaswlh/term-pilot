"use client";

import { Streamdown, defaultRehypePlugins, type Components, type StreamdownProps } from "streamdown";
import { harden } from "rehype-harden";
import { cn } from "cn";

const prose = "text-base leading-[1.45] text-[color:var(--ink)]";

const hardenConfig = {
  defaultOrigin: "https://term-pilot.invalid",
  allowedImagePrefixes: ["https://term-pilot.invalid/images/"],
  allowedLinkPrefixes: ["*"],
  allowedProtocols: ["http", "https", "mailto"],
  allowDataImages: false,
};

const rehypePlugins = [defaultRehypePlugins.sanitize, [harden, hardenConfig]] as StreamdownProps["rehypePlugins"];

const components: Components = {
  p: ({ children, className, ...props }) => (
    <p {...props} className={cn(prose, "m-0 mb-2 last:mb-0", className)}>
      {children}
    </p>
  ),
  ul: ({ children, className, ...props }) => (
    <ul {...props} className={cn(prose, "my-2 list-disc space-y-1 pl-5", className)}>
      {children}
    </ul>
  ),
  ol: ({ children, className, ...props }) => (
    <ol {...props} className={cn(prose, "my-2 list-decimal space-y-1 pl-5", className)}>
      {children}
    </ol>
  ),
  li: ({ children, className, ...props }) => (
    <li {...props} className={cn(prose, className)}>
      {children}
    </li>
  ),
  strong: ({ children, className, ...props }) => (
    <strong {...props} className={cn(prose, "font-semibold", className)}>
      {children}
    </strong>
  ),
  a: ({ children, className, href, ...props }) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(prose, "text-[color:var(--accent)] underline underline-offset-2", className)}
    >
      {children}
    </a>
  ),
  inlineCode: ({ children, className, ...props }) => (
    <code
      {...props}
      className={cn(
        "rounded px-1 py-0.5 font-[family-name:var(--mono)] text-[0.9em]",
        "bg-[color:var(--field)] text-[color:var(--ink)]",
        className,
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children, className, ...props }) => (
    <pre
      {...props}
      className={cn(
        prose,
        "my-2 max-w-full overflow-x-auto rounded-lg border border-[color:var(--line)]",
        "bg-[color:var(--field)] p-3 font-[family-name:var(--mono)] text-[0.875em]",
        className,
      )}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => (
    <code {...props} className={cn("font-[family-name:var(--mono)]", className)}>
      {children}
    </code>
  ),
};

export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <Streamdown
      className={cn("min-w-0 max-w-full", prose)}
      skipHtml
      isAnimating={false}
      controls={false}
      lineNumbers={false}
      animated={false}
      components={components}
      rehypePlugins={rehypePlugins}
    >
      {children}
    </Streamdown>
  );
}
