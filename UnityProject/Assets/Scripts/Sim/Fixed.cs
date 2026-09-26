namespace TechWar.Sim
{
    public static class Fixed
    {
        public const int Scale = 1000;

        public static int FromInt(int value) => checked(value * Scale);
        public static int ToInt(int value) => value / Scale;
        public static int Mul(int left, int right) => checked((int)((long)left * right / Scale));
        public static int Div(int left, int right) => checked((int)((long)left * Scale / right));
    }
}
