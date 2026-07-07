import {initTRPC} from '@trpc/server';
import {Context} from "./index";
import {z} from "zod";

const t = initTRPC.context<Context>().create();

const router = t.router;
const publicProcedure = t.procedure;

const simIdInput = z.object({
  id: z.string().default('default')
});

const typeInput = z.object({
  type: z.enum(['follow', 'circle']).default('follow')
});

const speedInput = z.object({
  speed: z.number().default(10)
});

const positionInput = z.object({
  latitude: z.number(),
  longitude: z.number()
});

const createSimInput = simIdInput.extend(typeInput.shape).extend(speedInput.shape);
const setTypeInput = simIdInput.extend(typeInput.shape);
const setSpeedInput = simIdInput.extend(speedInput.shape);
const setTargetInput = simIdInput.extend(positionInput.shape);
const setCurrentInput = simIdInput.extend(positionInput.shape);

export const appRouter = router({

  listSims: publicProcedure
    .query(({ctx}) => {
      return ctx.simRegistry.list();
    }),

  simState: publicProcedure
    .input(simIdInput)
    .query(async ({input, ctx}) => {
      return ctx.simRegistry.get(input.id).simState;
    }),

  createSim: publicProcedure
    .input(createSimInput)
    .mutation(async ({input, ctx}) => {
      const sim = ctx.simRegistry.create(input.id, input.type);
      return {id: sim.id, simState: sim.simState};
    }),

  deleteSim: publicProcedure
    .input(simIdInput)
    .mutation(async ({input, ctx}) => {
      ctx.simRegistry.remove(input.id);
    }),

  setTarget: publicProcedure
    .input(setTargetInput)
    .mutation(async ({input, ctx}) => {
      const sim = ctx.simRegistry.get(input.id, true);
      return sim.setTarget({latitude: input.latitude, longitude: input.longitude});
    }),

  setType: publicProcedure
    .input(setTypeInput)
    .mutation(async ({input, ctx}) => {
      const sim = ctx.simRegistry.get(input.id);
      return sim.setType(input.type);
    }),

  setCurrent: publicProcedure
    .input(setCurrentInput)
    .mutation(async ({input, ctx}) => {
      const sim = ctx.simRegistry.get(input.id);
      return sim.setCurrent({latitude: input.latitude, longitude: input.longitude});
    }),

  setSpeed: publicProcedure
    .input(setSpeedInput)
    .mutation(async ({input, ctx}) => {
      const sim = ctx.simRegistry.get(input.id);
      return sim.setSpeed(input.speed);
    }),


  onSimListChange: publicProcedure
    .subscription(async function* ({ctx, signal}) {
      yield ctx.simRegistry.list().map(sim => sim.id);
      while (signal && !signal.aborted) {
        await ctx.simRegistry.listChange()
        yield ctx.simRegistry.list().map(sim => sim.id);
      }
    }),

  onSimStateChange: publicProcedure
    .input(simIdInput)
    .subscription(async function* ({input, ctx, signal}) {
      const sim = ctx.simRegistry.get(input.id);
      yield sim.simState; // send state immediately
      while (signal && !signal.aborted) {
        await sim.nextUpdate()
        yield sim.simState;
      }
    }),

});

export type AppRouter = typeof appRouter;