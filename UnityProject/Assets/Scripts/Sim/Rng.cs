namespace TechWar.Sim
{
    public sealed class Rng
    {
        private uint x, y, z, w;

        public Rng(uint seed)
        {
            ulong mixer = seed;
            x = Mix(ref mixer); y = Mix(ref mixer);
            z = Mix(ref mixer); w = Mix(ref mixer);
            if ((x | y | z | w) == 0) w = 1;
        }

        public uint Next()
        {
            var t = x ^ (x << 11);
            x = y; y = z; z = w;
            w = w ^ (w >> 19) ^ t ^ (t >> 8);
            return w;
        }

        public int Int(int maxExclusive)
        {
            if (maxExclusive <= 0) throw new System.ArgumentOutOfRangeException(nameof(maxExclusive));
            return (int)(Next() % (uint)maxExclusive);
        }

        internal void WriteState(System.IO.BinaryWriter writer)
        {
            writer.Write(x); writer.Write(y); writer.Write(z); writer.Write(w);
        }

        private static uint Mix(ref ulong state)
        {
            unchecked
            {
                state += 0x9E3779B97F4A7C15UL;
                var value = state;
                value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9UL;
                value = (value ^ (value >> 27)) * 0x94D049BB133111EBUL;
                return (uint)(value ^ (value >> 31));
            }
        }
    }
}
