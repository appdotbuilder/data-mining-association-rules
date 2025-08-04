
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  loginInputSchema, 
  createItemInputSchema, 
  updateItemInputSchema,
  createTransactionInputSchema,
  miningParametersSchema,
  excelImportInputSchema
} from './schema';

// Import handlers
import { login, getCurrentUser } from './handlers/auth';
import { createItem, getItems, getItemById, updateItem, deleteItem } from './handlers/items';
import { createTransaction, getTransactions, getTransactionById, deleteTransaction, getTransactionItems } from './handlers/transactions';
import { importTransactionsFromExcel, validateExcelFormat } from './handlers/excel_import';
import { runAprioriMining, runFPGrowthMining, compareMiningResults, getMiningResults, getMiningResultById } from './handlers/mining';

// Define context type
type Context = {
  userId: number;
  userRole: string;
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),
  
  getCurrentUser: publicProcedure
    .input(z.string())
    .query(({ input }) => getCurrentUser(input)),

  // Items management
  createItem: publicProcedure
    .input(createItemInputSchema)
    .mutation(({ input, ctx }) => createItem(input, ctx.userId)),
  
  getItems: publicProcedure
    .query(() => getItems()),
  
  getItemById: publicProcedure
    .input(z.number())
    .query(({ input }) => getItemById(input)),
  
  updateItem: publicProcedure
    .input(updateItemInputSchema)
    .mutation(({ input, ctx }) => updateItem(input, ctx.userId)),
  
  deleteItem: publicProcedure
    .input(z.number())
    .mutation(({ input, ctx }) => deleteItem(input, ctx.userId)),

  // Transactions management
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input, ctx }) => createTransaction(input, ctx.userId)),
  
  getTransactions: publicProcedure
    .query(({ ctx }) => getTransactions(ctx.userId)),
  
  getTransactionById: publicProcedure
    .input(z.number())
    .query(({ input, ctx }) => getTransactionById(input, ctx.userId)),
  
  deleteTransaction: publicProcedure
    .input(z.number())
    .mutation(({ input, ctx }) => deleteTransaction(input, ctx.userId)),
  
  getTransactionItems: publicProcedure
    .input(z.number())
    .query(({ input }) => getTransactionItems(input)),

  // Excel import
  importTransactionsFromExcel: publicProcedure
    .input(excelImportInputSchema)
    .mutation(({ input, ctx }) => importTransactionsFromExcel(input, ctx.userId)),
  
  validateExcelFormat: publicProcedure
    .input(excelImportInputSchema)
    .mutation(({ input }) => validateExcelFormat(input)),

  // Data mining
  runAprioriMining: publicProcedure
    .input(miningParametersSchema)
    .mutation(({ input, ctx }) => runAprioriMining(input, ctx.userId)),
  
  runFPGrowthMining: publicProcedure
    .input(miningParametersSchema)
    .mutation(({ input, ctx }) => runFPGrowthMining(input, ctx.userId)),
  
  compareMiningResults: publicProcedure
    .input(miningParametersSchema)
    .mutation(({ input, ctx }) => compareMiningResults(input, ctx.userId)),
  
  getMiningResults: publicProcedure
    .query(({ ctx }) => getMiningResults(ctx.userId)),
  
  getMiningResultById: publicProcedure
    .input(z.number())
    .query(({ input, ctx }) => getMiningResultById(input, ctx.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext(): Context {
      // Context should include user authentication info
      // This is a placeholder - real implementation should extract user from JWT token
      return {
        userId: 1, // Placeholder user ID
        userRole: 'admin' // Placeholder user role
      };
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
