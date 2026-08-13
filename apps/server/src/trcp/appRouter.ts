import {initTRPC} from '@trpc/server';
import {Context} from "./trpcContext";
import {number, z} from "zod";
import {simulationService} from "../index";

const t = initTRPC.context<Context>().create();

const router = t.router;
const publicProcedure = t.procedure;

const simIdInput = z.object({
  id: z.string().min(1).max(64)
});

const positionInput = z.object({
  latitude: z.number(),
  longitude: z.number()
}).optional();

const simConfigInput = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['follow', 'circle']).optional(),
  target: positionInput.optional(),
  initialDistance: number().optional(),
  initialAzimuth: number().optional(),
  speed: z.number().default(10).optional()
});


export type SimConfigInput = z.infer<typeof simConfigInput>;

export const appRouter = router({

  listSims: publicProcedure
    .query(() => {
      return simulationService.list();
    }),

  createSim: publicProcedure
    .input(simConfigInput)
    .mutation(async ({input}) => {
      return simulationService.create(input);
    }),

  updateSim: publicProcedure
    .input(simConfigInput)
    .mutation(async ({input}) => {
      simulationService.update(input);
    }),

  deleteSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input}) => {
      simulationService.remove(input.id);
    }),

  startSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input}) => {
      return simulationService.startSim(input.id);
    }),

  stopSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input}) => {
      simulationService.stopSim(input.id);
    }),

  onSimListChange: publicProcedure
    .subscription(() => simulationService.configListStream.collect()),

  onSimChange: publicProcedure
    .input(simIdInput)
    .subscription(({input}) => {
      const stream = simulationService.getSimStream(input.id);
      if (!stream) throw new Error(`Simulation not found: ${input.id}`);
      return stream.collect()
    }),

});

export type AppRouter = typeof appRouter;