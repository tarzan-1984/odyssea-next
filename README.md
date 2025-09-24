# TailAdmin Next.js TypeScript Pro

A premium Next.js admin dashboard template built with TypeScript, Tailwind CSS, and modern React patterns.

## 🚀 Features

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS 4** for styling
- **React 19** with latest features
- **Responsive Design** for all devices
- **Dark/Light Theme** support
- **Component Library** with 100+ components
- **ESLint & Prettier** for code quality
- **Pre-commit hooks** for automatic formatting

## 📋 Prerequisites

- Node.js 22+ (recommended)
- Yarn package manager

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd odyssea-backend-ui
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Setup Husky (pre-commit hooks)**

   ```bash
   yarn prepare
   ```

4. **Start development server**
   ```bash
   yarn dev
   ```

## 📚 Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Check code with ESLint
- `yarn lint:fix` - Fix ESLint errors automatically
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting

## 🔧 Code Quality Tools

This project is configured with:

- **ESLint** - Code linting with React/Next.js best practices
- **Prettier** - Code formatting with tab indentation
- **Husky** - Git hooks for pre-commit validation
- **lint-staged** - Run linters on staged files only

### ESLint Configuration

ESLint is configured with:

- Next.js core web vitals rules
- TypeScript support
- React best practices
- Code quality rules
- Tab indentation enforcement

### Prettier Configuration

Prettier is configured with:

- Tab indentation (2 spaces equivalent)
- 100 character line length
- Single quotes for strings
- Semicolons required
- Trailing commas

### Pre-commit Hooks

Before each commit, the following automatically runs:

1. ESLint with auto-fix
2. Prettier formatting
3. Commit is blocked if errors remain

## 🎨 Component Library

The project includes a comprehensive component library:

- **UI Elements**: Buttons, forms, modals, tables
- **Charts**: Bar, line, pie charts with ApexCharts
- **Layout**: Sidebar, header, navigation components
- **Pages**: Dashboard, analytics, e-commerce, user management
- **Forms**: Input fields, validation, file uploads

## 🌐 Pages & Features

- **Dashboard**: Analytics, metrics, and overview
- **E-commerce**: Products, orders, invoices
- **User Management**: User lists, profiles, authentication
- **Analytics**: Charts, reports, data visualization
- **File Management**: Upload, organize, manage files
- **Email**: Inbox, compose, templates
- **Calendar**: Event management and scheduling

## 🚀 Deployment

1. **Build the project**

   ```bash
   yarn build
   ```

2. **Start production server**
   ```bash
   yarn start
   ```

## 📖 Documentation

For detailed information about:

- **Linting & Formatting**: See [LINTING_README.md](./LINTING_README.md)
- **Component Usage**: Check individual component files
- **API Routes**: Review `src/app/api/` directory

## 🤝 Contributing

1. Follow the established code style (ESLint + Prettier)
2. Ensure all tests pass
3. Follow React and Next.js best practices
4. Use TypeScript for all new code

## 📄 License

This is a premium template. Please refer to the license terms in your purchase agreement.

## 🆘 Support

For support and questions:

- Check the documentation
- Review the component examples
- Contact the development team

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
