import {publicProcedure, router} from './trpc';
import {z} from "zod";
import {getOrCreateSim, listSims} from "./sim";

const simIdInput = z.object({id: z.string().optional()});
const setTargetInput = simIdInput.extend({latitude: z.number(), longitude: z.number()});
const setCurrentInput = simIdInput.extend({latitude: z.number(), longitude: z.number()});

export const appRouter = router({

  listSims: publicProcedure
    .query(() => {
      return listSims();
    }),

  simState: publicProcedure
    .input(simIdInput)
    .query(async ({input}) => {
      return getOrCreateSim(input.id).simState;
    }),

  setTarget: publicProcedure
    .input(setTargetInput)
    .mutation(async ({input}) => {
      const sim = getOrCreateSim(input.id);
      return sim.setTarget({latitude: input.latitude, longitude: input.longitude});
    }),

  setCurrent: publicProcedure
    .input(setCurrentInput)
    .mutation(async ({input}) => {
      const sim = getOrCreateSim(input.id);
      return sim.setCurrent({latitude: input.latitude, longitude: input.longitude});
    }),

  onSimStateChange: publicProcedure
    .input(simIdInput)
    .subscription(async function* ({input, signal}) {
      const sim = getOrCreateSim(input.id);
      yield sim.simState; // send state immediately
      while (signal && !signal.aborted) {
        yield sim.simState;
        await sim.nextUpdate()
      }
    }),

});

export type AppRouter = typeof appRouter;
