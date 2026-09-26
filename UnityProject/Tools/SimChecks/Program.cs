using System;
using System.Reflection;
using NUnit.Framework;
using TechWar.Tests;

// Runs the shared, synchronous NUnit tests without launching the Unity Editor.
internal static class Program
{
    private static int Main()
    {
        var failed = 0;
        var total = 0;
        foreach (var testType in new[] { typeof(SimulationTests), typeof(SemiconTests), typeof(MedicSkillTests), typeof(OrchardTests) })
        foreach (var method in testType.GetMethods())
        {
            if (method.GetCustomAttribute<TestAttribute>() == null) continue;
            total++;
            try
            {
                method.Invoke(Activator.CreateInstance(testType), null);
                Console.WriteLine("PASS " + method.Name);
            }
            catch (TargetInvocationException error)
            {
                failed++;
                Console.WriteLine("FAIL " + method.Name + ": " + error.InnerException.Message);
            }
        }
        Console.WriteLine($"{total - failed}/{total} passed; {failed} failed");
        return failed == 0 && total > 0 ? 0 : 1;
    }
}
