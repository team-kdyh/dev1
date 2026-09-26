namespace TechWar.Sim
{
    public enum StatusKind
    {
        Stun,
        Silence,
        Slow,
        Malfunction,
        Charm,
        AttackUp,
        DefenseUp
    }

    public sealed class StatusEffect
    {
        public StatusKind Kind;
        public int RemainingTicks;
        public int Magnitude;
        public int SourceId;
    }
}
