import {initTRPC} from '@trpc/server';
import {Context} from "./index";
import {createSim, deleteSim, getSim, listSims} from "./sim";
import {z} from "zod";

const t = initTRPC.context<Context>().create();

const router = t.router;
const publicProcedure = t.procedure;

const simIdInput = z.object({id: z.string().default('default')});
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
      return getSim(input.id).simState;
    }),

  createSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input}) => {
      const sim = createSim(input.id);
      return {id: sim.id, simState: sim.simState};
    }),

  deleteSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input}) => {
      deleteSim(input.id);
    }),

  setTarget: publicProcedure
    .input(setTargetInput)
    .mutation(async ({input}) => {
      const sim = getSim(input.id, true);
      return sim.setTarget({latitude: input.latitude, longitude: input.longitude});
    }),

  setCurrent: publicProcedure
    .input(setCurrentInput)
    .mutation(async ({input}) => {
      const sim = getSim(input.id);
      return sim.setCurrent({latitude: input.latitude, longitude: input.longitude});
    }),

  onSimStateChange: publicProcedure
    .input(simIdInput)
    .subscription(async function* ({input, signal}) {
      const sim = getSim(input.id);
      yield sim.simState; // send state immediately
      while (signal && !signal.aborted) {
        await sim.nextUpdate()
        yield sim.simState;
      }
    }),

});

export type AppRouter = typeof appRouter;