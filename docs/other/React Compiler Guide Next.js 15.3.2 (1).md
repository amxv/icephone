# React Compiler Best Practices Guide

*For React 19 with Next.js 15.3.2*

## Philosophy Change

**Before:** Manual `memo()`, `useMemo()`, `useCallback()` everywhere
**Now:** Write clean code, let compiler optimize automatically

## Core Principles

### 1. Write Simple, Pure Components

```jsx
// ✅ Let compiler handle optimization
function ProductList({ products, searchTerm }) {
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClick = (id) => {
    onProductSelect(id);
  };

  return (
    <div>
      {filteredProducts.map(product =>
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => handleClick(product.id)}
        />
      )}
    </div>
  );
}
```

### 2. Stop Manual Memoization (Usually)

```jsx
// ❌ Old approach
const Component = memo(({ data }) => {
  const processed = useMemo(() => data.map(transform), [data]);
  const handleClick = useCallback((id) => onClick(id), [onClick]);
  return <div>{/* render */}</div>;
});

// ✅ New approach
function Component({ data }) {
  const processed = data.map(transform);
  const handleClick = (id) => onClick(id);
  return <div>{/* render */}</div>;
}
```

## When to Still Use Manual Memoization

### Keep `useMemo` for Expensive Operations

```jsx
const processedData = useMemo(() => {
  return rawData
    .filter(/* complex filtering */)
    .map(/* expensive transformation */)
    .sort(/* complex sorting */);
}, [rawData]);
```

### Keep `useCallback` for External Libraries

```jsx
const handleMapClick = useCallback((coords) => {
  externalMapLibrary.setCenter(coords);
}, []);
```

## Next.js Configuration

```js
// next.config.js
const nextConfig = {
  experimental: {
    reactCompiler: true
  }
};
```

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "plugin:react-hooks/recommended"],
  "plugins": ["react-compiler"],
  "rules": {
    "react-compiler/react-compiler": "error"
  }
}
```

## Avoid These Patterns

```jsx
// ❌ Side effects in render
function Bad({ items }) {
  localStorage.setItem('count', items.length); // Don't do this
  return <div>{items.length}</div>;
}

// ❌ Mutating props
function Bad({ user }) {
  user.lastSeen = Date.now(); // Don't mutate
  return <div>{user.name}</div>;
}

// ❌ Mixing old and new patterns
const Bad = memo(({ data }) => {
  const result = useMemo(() => process(data), [data]); // Redundant
  return <div>{result}</div>;
});
```

## Migration Strategy

1. **New components:** Use compiler patterns from the start
2. **Existing components:** Remove manual memoization gradually
3. **Performance:** Measure with React DevTools, add manual optimization only when needed
4. **Trust the compiler:** Focus on code clarity over optimization

## Key Takeaway

Write readable, pure React components. Let the compiler handle performance optimization. Only add manual memoization when you measure a specific performance need.
