import {publicProcedure, router} from './trpc';
import {z} from "zod";
import {nextSimStateUpdate, setCurrent, setTarget, simState} from "./sim";

export const appRouter = router({

  simState: publicProcedure
    .query(async () => {
      return simState;
    }),

  setTarget: publicProcedure
    .input(z.object({latitude: z.number(), longitude: z.number()}))
    .mutation(async (opts) => {
      const {input} = opts;
      return setTarget({latitude: input.latitude, longitude: input.longitude});
    }),

  setCurrent: publicProcedure
    .input(z.object({latitude: z.number(), longitude: z.number()}))
    .mutation(async (opts) => {
      const {input} = opts;
      return setCurrent({latitude: input.latitude, longitude: input.longitude});
    }),

  onSimStateChange: publicProcedure.subscription(async function* (opts) {
    yield simState;
    while (opts.signal && !opts.signal.aborted) {
      yield simState;
      await nextSimStateUpdate()
    }
  }),


});

export type AppRouter = typeof appRouter;
