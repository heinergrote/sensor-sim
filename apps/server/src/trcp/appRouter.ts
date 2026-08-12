import {initTRPC} from '@trpc/server';
import {Context} from "./trpcContext";
import {number, z} from "zod";
import {simConfigRegistry, simulationRegistry} from "../index";

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
      return simConfigRegistry.list();
    }),

  createSim: publicProcedure
    .input(simConfigInput)
    .mutation(async ({input}) => {
      return simConfigRegistry.create(input);
    }),

  updateSim: publicProcedure
    .input(simConfigInput)
    .mutation(async ({input}) => {
      simConfigRegistry.update(input);
    }),

  deleteSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input}) => {
      simConfigRegistry.remove(input.id);
    }),

  onSimListChange: publicProcedure
    .subscription(() => simConfigRegistry.configListStream.collect()),

  onSimStateChange: publicProcedure
    .input(simIdInput)
    .subscription(({input}) => {
      const stream = simulationRegistry.getSimulationDataStream(input.id);
      if (!stream) throw new Error(`Simulation not found: ${input.id}`);
      return stream.collect()
    }),

});

export type AppRouter = typeof appRouter;