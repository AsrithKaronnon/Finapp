import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  children,
  className = '',
  hoverEffect = false,
  glass = false,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={`
        rounded-[12px] border border-border bg-card text-card-foreground shadow-card overflow-hidden
        transition-all duration-150 ease-in-out hover:bg-muted/10 hover:-translate-y-[1px] hover:shadow-md
        ${glass ? 'glass' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-4 sm:p-6 flex flex-col gap-1 border-b border-border ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`card-title ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-muted-foreground ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-4 sm:p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-4 sm:p-6 bg-muted/20 border-t border-border flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);
